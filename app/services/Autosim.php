<?php
class Autosim
{
  const DAY_MINUTES = 480; // 8h

  // ECON (la minut)
  private const ECON = [
    'F_base' => 120,   // clienți/zi
    'C0'     => 0.50,
    'epsilon'=> 1.6,
    'alpha'  => 0.75,
    'beta'   => 0.50,
    'kappa'  => 0.60, 'delta'=>0.10,
    'Wmax'   => 6.0,  'tau'=>3.0,
    'rho'    => 0.75,
  ];

  public static function runTick(int $profileId, int $minutesWanted = null): void
  {
    $pdo = pdo();

    // 1) Citește profil
    $pr = $pdo->query("SELECT * FROM fk_profiles WHERE id={$profileId}")->fetch();
    if (!$pr) return;

    // dacă e pauză → nu rulăm
    if (!(int)$pr['autosim_running']) return;

    // derivă minute de rulat din last_tick_at (sau folosește speed)
    $now = new DateTimeImmutable('now');
    $last = !empty($pr['last_tick_at']) ? new DateTimeImmutable($pr['last_tick_at']) : $now;
    $realDiffMin = max(0, (int)floor(($now->getTimestamp() - $last->getTimestamp()) / 60));
    $speed = max(1, (int)$pr['autosim_speed']);

    $minutes = $minutesWanted ?? max(1, min(60, $realDiffMin * $speed));
    if ($minutes <= 0) {
      // totuși actualizează last_tick_at ca watchdog
      $st = $pdo->prepare("UPDATE fk_profiles SET last_tick_at=NOW() WHERE id=?");
      $st->execute([$profileId]);
      return;
    }

    // 2) Import automat din atelier (o dată per tick)
    self::importTransfer($profileId);

    // 3) Rulează minutele (sim granular)
    for ($i=0; $i<$minutes; $i++) {
      self::stepMinute($profileId, $pr);
    }

    // 4) persist last_tick_at
    $st = $pdo->prepare("UPDATE fk_profiles SET last_tick_at=NOW() WHERE id=?");
    $st->execute([$profileId]);
  }

  private static function importTransfer(int $pid): void
  {
    $t = TransferModel::read($pid);
    if (($t['qty'] ?? 0) <= 0) return;

    // produsul activ
    $product = ProductModel::activeForProfile($pid);
    if (!empty($product['id'])) {
      InventoryModel::addLot($pid, (int)$product['id'], (int)$t['qty'], (float)$t['avg_q']);
    }
    // buffs
    foreach ($t['buffs'] as $b) {
      $mins = (int)($b['minutes'] ?? 45);
      BuffModel::addTimed($pid, $b['label'] ?? 'Boost', (float)($b['trafficMult'] ?? 1.0), (float)($b['qBonus'] ?? 0.0), 0.0, $mins);
    }
    TransferModel::clear($pid);
  }

  private static function stepMinute(int $pid, array &$pr): void
  {
    $pdo = pdo();
    // re-citește profil minimal (timp/zi) fresh
    $st = $pdo->prepare("SELECT season, day_num, time_min, open_min, close_min, cash, reputation, economy_index, hh_social_today, flyer_days_left FROM fk_profiles WHERE id=?");
    $st->execute([$pid]); $pr = $st->fetch() ?: $pr;

    $open  = (int)$pr['open_min'];  $close = (int)$pr['close_min'];
    $time  = (int)$pr['time_min'];  $dayEnd = $open + self::DAY_MINUTES;

    // avans timp
    $time += 1;

    // 1) producție matinală (primele 120 min)
    if ($time - $open < 120) {
      self::morningProduction($pid);
    }

    // 2) trafic & vânzare
    $A = self::getAggRow($pid); // sold,rev,cogs,N,C,W,Q acumulate
    [$Nday, $C, $W, $Q, $P, $demandMin] = self::economicsMinute($pid, $pr);
    $soldInfo = self::sellFromStock($pid, $demandMin);
    $sold = $soldInfo['sold']; $rev = $sold * $P;
    $unitCost = self::unitCostForActive($pid);
    $cogs = $sold * $unitCost;

    $A['sold'] += $sold;  $A['rev'] += $rev;  $A['cogs'] += $cogs;
    $A['N'] = $Nday; $A['C'] = $C; $A['W'] = $W; $A['Q'] = $Q;
    self::saveAggRow($pid, $A);

    // cash live (venit)
    $st = $pdo->prepare("UPDATE fk_profiles SET cash=cash+? WHERE id=?");
    $st->execute([ $rev, $pid ]);

    // 3) Buff tick (doar expirări se rezolvă natural la citire; nimic de făcut/minut)
    // 4) End of day?
    if ($time >= $dayEnd) {
      self::endOfDay($pid, $pr, $A);
      // zi nouă
      $time = $open;
      self::advanceDay($pid, $pr);
    }

    // persist timp curent
    $st = $pdo->prepare("UPDATE fk_profiles SET time_min=? WHERE id=?");
    $st->execute([ $time, $pid ]);
  }

  private static function morningProduction(int $pid): void
  {
    $product = ProductModel::activeForProfile($pid);
    if (!$product) return;

    // capacități simple
    $ovenBatchSize = 50;
    $ovenBatchesPerDay = 2;
    $planPerDay = max(0, (int)($product['planned_qty'] ?? 100));
    $capPerDay  = $ovenBatchSize * $ovenBatchesPerDay;

    $perMinPlan = (int)ceil($planPerDay / 120);
    $perMinCap  = (int)ceil($capPerDay  / self::DAY_MINUTES * 2); // mai generos dimineața
    $toMake     = max(0, min($perMinPlan, $perMinCap, self::maxByIngredients($pid, $product)));

    if ($toMake > 0) {
      self::consumeIngredients($pid, $product, $toMake);
      $baseQ = 0.86 + 0.02; // mic bonus “cuptor”
      $noise = mt_rand(-3,3)/100.0; // ±0.03
      $q = max(0.70, min(0.98, $baseQ + $noise + self::buffQBonus($pid)));
      InventoryModel::addLot($pid, (int)$product['id'], $toMake, $q);
    }
  }

  private static function unitCostForActive(int $pid): float
  {
    $p = ProductModel::activeForProfile($pid);
    $ing = (float)($p['cost_ingredients'] ?? 3.0);
    $labor = (float)($p['cost_labor_var'] ?? 0.5);
    return $ing + $labor;
  }

  private static function economicsMinute(int $pid, array $pr): array
  {
    $EC = self::ECON;
    $buff = self::buffAggregate($pid);
    $seasonEff = self::seasonEffects($pr['season']);
    $weatherEff= self::weatherEffects(self::currentWeather($pid));

    $marketingMult = (int)$pr['hh_social_today'] ? 1.25 : 1.00;
    if ((int)$pr['flyer_days_left'] > 0) $marketingMult *= 1.10;

    $Nday = (int)round(
      $EC['F_base'] *
      (float)$pr['economy_index'] *
      (float)$pr['reputation'] *
      $seasonEff['traffic'] * $weatherEff['traffic'] *
      $buff['trafficMult'] *
      $marketingMult
    );

    // parametri produs
    $p = ProductModel::activeForProfile($pid);
    $P0 = (float)($p['P0'] ?? 10.0);
    $P  = (float)($p['price'] ?? $P0);

    // happy hour (dacă se suprapune în minutul curent, reducere)
    $time = (int)$pr['time_min'];
    $hhOk = !empty($p['hh_enabled']);
    if ($hhOk) {
      $s = self::toMin($p['hh_start'] ?? '16:00'); $e=self::toMin($p['hh_end'] ?? '17:00');
      if ($time >= $s && $time < $e) $P = $P * (1 - max(0.05, min(0.25, (int)($p['hh_discount_percent'] ?? 10)/100)));
    }

    // calitate medie + conversie
    $Q = max(0.0, min(1.0, self::avgQuality($pid) + $buff['qBonus']));
    $lambdaMin = max(0.0, $Nday / self::DAY_MINUTES);
    // sosiri “discrete” ca în jocul vechi (3 probe)
    $arrivals = 0; for($i=0;$i<3;$i++) if (mt_rand()/mt_getrandmax() < $lambdaMin) $arrivals++;

    $mu = 1.5 + 0.8; // POS rapid implicit
    $W = max(0.0, min($EC['Wmax'], (($arrivals - $mu) * $EC['tau']) + $buff['wBonus'] + $seasonEff['wait'] + $weatherEff['wait']));

    $priceTerm   = exp(-$EC['epsilon'] * ($P/$P0 - 1));
    $qualityTerm = $EC['alpha'] + $EC['beta'] * $Q;
    $waitPen     = 1 - min($EC['kappa'], $EC['delta'] * max(0,$W));
    $C = max(0.0, min(0.95, $EC['C0'] * $priceTerm * $qualityTerm * $waitPen));

    $demandMin = max(0, (int)round($arrivals * $C));
    return [$Nday, (float)round($C,2), (float)round($W,2), (float)round($Q,2), (float)$P, $demandMin];
  }

  private static function sellFromStock(int $pid, int $qty): array
  {
    if ($qty <= 0) return ['sold'=>0];

    $pdo = pdo();
    // loturi FIFO pt. produsul activ
    $prod = ProductModel::activeForProfile($pid);
    $st = $pdo->prepare("SELECT * FROM fk_inventory_lot WHERE profile_id=? AND product_id=? AND qty>0 ORDER BY id ASC");
    $st->execute([$pid, (int)$prod['id']]);

    $left = $qty; $sold=0;
    while (($lot = $st->fetch()) && $left > 0) {
      $take = min($lot['qty'], $left);
      $upd = $pdo->prepare("UPDATE fk_inventory_lot SET qty=qty-? WHERE id=?");
      $upd->execute([$take, $lot['id']]);
      $left -= $take; $sold += $take;
    }
    return ['sold'=>$sold];
  }

  private static function getAggRow(int $pid): array
  {
    $pdo = pdo();
    $st = $pdo->prepare("SELECT * FROM fk_autosim_agg_current WHERE profile_id=?");
    $st->execute([$pid]);
    $row = $st->fetch();
    if (!$row) {
      $pdo->prepare("INSERT IGNORE INTO fk_autosim_agg_current(profile_id) VALUES (?)")->execute([$pid]);
      $row = ['sold'=>0,'rev'=>0,'cogs'=>0,'N'=>0,'C'=>0,'W'=>0,'Q'=>0];
    }
    return $row;
  }

  private static function saveAggRow(int $pid, array $A): void
  {
    $pdo = pdo();
    $st = $pdo->prepare("REPLACE INTO fk_autosim_agg_current (profile_id,sold,rev,cogs,N,C,W,Q) VALUES (?,?,?,?,?,?,?,?)");
    $st->execute([$pid, (int)$A['sold'], $A['rev'], $A['cogs'], (int)$A['N'], (float)$A['C'], (float)$A['W'], (float)$A['Q']]);
  }

  private static function endOfDay(int $pid, array $pr, array $A): void
  {
    $pdo = pdo();

    // costuri ținere stoc + marketing + fixed + payroll simplificat
    $stockLeft = self::totalStockActive($pid);
    $holding = $stockLeft * 0.10;
    $marketing = ((int)$pr['hh_social_today'] ? 150 : 0) + (((int)$pr['flyer_days_left']>0) ? 80 : 0);
    $fixed = 150;
    $payroll = 250; // simplificat (poți lega ulterior de fk_staff)

    $profit = ($A['rev'] ?? 0) - ($A['cogs'] ?? 0) - $holding - $marketing - $fixed - $payroll;

    // cash: nimic de scăzut aici (am adăugat venituri live), dar scădem costuri fixe
    $pdo->prepare("UPDATE fk_profiles SET cash=cash-? WHERE id=?")->execute([ ($holding+$marketing+$fixed+$payroll), $pid ]);

    // perisabile & expirare loturi
    self::expireLotsAndPerishables($pid);

    // reputație
    $EC = self::ECON;
    $Q = (float)$A['Q']; $sold=(int)$A['sold']; $N=(int)$A['N']; $C=(float)$A['C'];
    $complaints = max(0.0, ($N>0) ? (1.0 - ($sold / max(1, (int)round($N*$C)))) : 0.0);
    $f = max(0.80, min(1.20, 0.9 + 0.25*($Q - 0.85) - 0.05*$complaints));
    $newRep = max(0.80, min(1.20, $EC['rho'] * (float)$pr['reputation'] + (1-$EC['rho']) * $f));
    $pdo->prepare("UPDATE fk_profiles SET reputation=? WHERE id=?")->execute([$newRep, $pid]);

    // marketing consum
    if ((int)$pr['flyer_days_left'] > 0) {
      $pdo->prepare("UPDATE fk_profiles SET flyer_days_left=GREATEST(flyer_days_left-1,0), hh_social_today=0 WHERE id=?")->execute([$pid]);
    } else {
      $pdo->prepare("UPDATE fk_profiles SET hh_social_today=0 WHERE id=?")->execute([$pid]);
    }

    // raportul pe zi
    $pdo->prepare("INSERT INTO fk_daily_reports (profile_id,season,day_num,sold,revenue,cogs,holding,marketing,fixed,payroll,profit,q_avg,w_avg,c_avg) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([$pid,$pr['season'],$pr['day_num'],(int)$A['sold'],$A['rev'],$A['cogs'],$holding,$marketing,$fixed,$payroll,$profit,$A['Q'],$A['W'],$A['C']]);

    // reset agregate
    $pdo->prepare("UPDATE fk_autosim_agg_current SET sold=0,rev=0,cogs=0,N=0,C=0,W=0,Q=0 WHERE profile_id=?")->execute([$pid]);
  }

  private static function advanceDay(int $pid, array $pr): void
  {
    $season = $pr['season'];
    $day = (int)$pr['day_num'] + 1;
    if ($day > 28) {
      $day = 1;
      $season = ($season==='primavara')?'vara':(($season==='vara')?'toamna':(($season==='toamna')?'iarna':'primavara'));
    }
    pdo()->prepare("UPDATE fk_profiles SET day_num=?, season=?, time_min=open_min WHERE id=?")
         ->execute([$day, $season, $pid]);

    // rulează vremea “nouă zi”
    self::rollWeather($pid, $season);
  }

  // ---------- Helpers ----------
  private static function buffAggregate(int $pid): array {
    $pdo=pdo(); $st=$pdo->prepare("SELECT traffic_mult,q_bonus,w_bonus FROM fk_buffs WHERE profile_id=? AND expires_at>NOW()");
    $st->execute([$pid]); $t=1.0; $q=0; $w=0;
    foreach($st as $b){ $t*=(float)$b['traffic_mult']; $q+=(float)$b['q_bonus']; $w+=(float)$b['w_bonus']; }
    return ['trafficMult'=>max(0.90,min(1.30,$t)),'qBonus'=>max(-0.05,min(0.05,$q)),'wBonus'=>max(-1.5,min(1.5,$w))];
  }
  private static function buffQBonus(int $pid): float { return self::buffAggregate($pid)['qBonus']; }

  private static function totalStockActive(int $pid): int {
    $p=ProductModel::activeForProfile($pid); if(!$p) return 0;
    return InventoryModel::totalStock($pid, (int)$p['id']);
  }
  private static function avgQuality(int $pid): float {
    $pdo=pdo(); $p=ProductModel::activeForProfile($pid); if(!$p) return 0.86;
    $st=$pdo->prepare("SELECT SUM(qty*q) sw, SUM(qty) s FROM fk_inventory_lot WHERE profile_id=? AND product_id=?");
    $st->execute([$pid,(int)$p['id']]); $r=$st->fetch(); $s=(int)($r['s']??0); $sw=(float)($r['sw']??0);
    return $s>0 ? round($sw/$s,2) : 0.86;
  }

  private static function toMin(string $hhmm): int { [$h,$m]=array_map('intval', explode(':',$hhmm.':00')); return $h*60+$m; }

  private static function seasonEffects(string $s): array {
    if ($s==='vara') return ['traffic'=>1.15,'wait'=>0.20];
    if ($s==='toamna') return ['traffic'=>0.95,'wait'=>0.00,'qBonus'=>0.02];
    if ($s==='iarna') return ['traffic'=>0.85,'wait'=>0.00];
    return ['traffic'=>1.00,'wait'=>0.00];
  }
  private static function weatherEffects(string $w): array {
    return match($w){
      'rain'  => ['traffic'=>0.92,'wait'=>0.20],
      'snow'  => ['traffic'=>0.85,'wait'=>0.30],
      'heat'  => ['traffic'=>0.97,'wait'=>0.40],
      'cloudy'=> ['traffic'=>0.98,'wait'=>0.05],
      default => ['traffic'=>1.00,'wait'=>0.00],
    };
  }
  private static function currentWeather(int $pid): string {
    // păstrăm simplu în fk_profiles.meta_weather dacă vrei, altfel lucid “sunny”
    $r = pdo()->query("SELECT meta_weather FROM fk_profiles WHERE id={$pid}")->fetch();
    return $r && !empty($r['meta_weather']) ? $r['meta_weather'] : 'sunny';
  }
  private static function rollWeather(int $pid, string $season): void {
    $r=mt_rand()/mt_getrandmax(); $next='sunny';
    if ($season==='vara')      $next = $r<0.50?'sunny':($r<0.72?'heat':($r<0.90?'cloudy':'rain'));
    elseif ($season==='toamna')$next = $r<0.35?'sunny':($r<0.65?'cloudy':($r<0.92?'rain':'sunny'));
    elseif ($season==='iarna') $next = $r<0.30?'sunny':($r<0.55?'cloudy':($r<0.85?'snow':'sunny'));
    else                       $next = $r<0.45?'sunny':($r<0.75?'cloudy':($r<0.92?'rain':'sunny'));
    pdo()->prepare("UPDATE fk_profiles SET meta_weather=? WHERE id=?")->execute([$next,$pid]);
  }

  // ---------- Ingrediente & rețete minimale ----------
  private static function maxByIngredients(int $pid, array $product): int {
    $rid = $product['recipe_id'] ?? 'croissant_plain';
    $need = self::recipe($rid);
    if (!$need) return PHP_INT_MAX;
    $min = PHP_INT_MAX;
    foreach ($need as $code=>$qty) {
      $have = self::ingredientQty($pid, $code);
      $min = min($min, intdiv($have, max(1,$qty)));
    }
    return $min;
  }
  private static function consumeIngredients(int $pid, array $product, int $count): void {
    $rid = $product['recipe_id'] ?? 'croissant_plain';
    $need = self::recipe($rid); if(!$need) return;
    foreach ($need as $code=>$q) {
      pdo()->prepare("UPDATE fk_ingredients SET qty=GREATEST(qty-?,0) WHERE profile_id=? AND code=?")
          ->execute([ $q*$count, $pid, $code ]);
    }
  }
  private static function ingredientQty(int $pid, string $code): int {
    $st=pdo()->prepare("SELECT qty FROM fk_ingredients WHERE profile_id=? AND code=?");
    $st->execute([$pid,$code]); $r=$st->fetch();
    return (int)($r['qty'] ?? 0);
  }
  private static function recipe(string $id): ?array {
    return [
      'croissant_plain' => ['flour'=>1,'milk'=>1,'sugar'=>1],
      'donut_plain'     => ['flour'=>1,'sugar'=>1,'milk'=>1,'butter'=>1,'eggs'=>1,'yeast'=>1],
      'eclair_vanilla'  => ['flour'=>1,'butter'=>1,'eggs'=>1,'sugar'=>1,'vanilla'=>1,'cream'=>1],
      'muffin_blueberry'=> ['flour'=>1,'sugar'=>1,'milk'=>1,'butter'=>1,'eggs'=>1,'blueberries'=>1],
    ][$id] ?? null;
  }

  private static function expireLotsAndPerishables(int $pid): void {
    $pdo=pdo();
    // îmbătrânire loturi + TTL produs activ
    $pdo->prepare("UPDATE fk_inventory_lot SET age_days=age_days+1 WHERE profile_id=?")->execute([$pid]);
    $prod = ProductModel::activeForProfile($pid);
    $ttl = (int)($prod['shelf_life_days'] ?? 2);
    $pdo->prepare("DELETE FROM fk_inventory_lot WHERE profile_id=? AND age_days>=?")->execute([$pid,$ttl]);
    // stricăm 20% din lactate/fructe
    foreach (['milk','strawberries'] as $code) {
      $pdo->prepare("UPDATE fk_ingredients SET qty=GREATEST(qty-CEIL(qty*0.20),0) WHERE profile_id=? AND code=?")->execute([$pid,$code]);
    }
  }
}
