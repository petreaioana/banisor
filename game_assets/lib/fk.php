<?php
/**
 * FinKids Tycoon — Core FK library
 * Ce face:
 *  - Gestionează sesiunea și structura de stare în $_SESSION['fk']
 *  - Curăță buff-urile expirate și recalculează boost %
 *  - Expune utilitare pentru inventar și răspuns JSON
 *
 * Funcții expuse:
 *  - fk_boot(): inițializează $_SESSION['fk']
 *  - fk_buff_cleanup_and_recalc(): curăță + recalculează boost
 *  - fk_state_response(): array cu starea (ok, product, stock, boost)
 *  - fk_add_inventory(int $qty, float $q): actualizează stoc + Q medie
 *  - fk_add_buff(string $id, string $label, int $minutes, float $trafficMult=1.0, float $qBonus=0.0)
 *  - json_out(array $arr): trimite JSON și exit
 *
 * Folosit de:
 *  - game_assets/api.php (router JSON)
 */

declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

function fk_boot(): void {
  if (!isset($_SESSION['fk'])) {
    $_SESSION['fk'] = [
      'product' => [ 'key' => 'cupcake', 'name' => 'Brioșă' ],
      'stock'   => [ 'units' => 0, 'avg_q' => 0.90 ],
      'boost'   => [ 'percent' => 0, 'buffs' => [] ], // percent = (mult-1)*100
    ];
  }
}

function fk_buff_cleanup_and_recalc(): void {
  $now = time();
  $buffs = $_SESSION['fk']['boost']['buffs'] ?? [];
  // Keep only non-expired
  $buffs = array_values(array_filter($buffs, function($b) use ($now) {
    return ($b['expires'] ?? 0) > $now;
  }));
  // Recalc traffic multiplier
  $mult = 1.0;
  foreach ($buffs as $b) {
    $m = isset($b['trafficMult']) ? floatval($b['trafficMult']) : 1.0;
    $mult *= max(0.0, $m);
  }
  $percent = round(($mult - 1.0) * 100);
  $_SESSION['fk']['boost']['buffs']   = $buffs;
  $_SESSION['fk']['boost']['percent'] = $percent;
}

function fk_state_response(): array {
  fk_boot();
  fk_buff_cleanup_and_recalc();
  $fk = $_SESSION['fk'];
  $now = time();
  $buffs = [];
  foreach ($fk['boost']['buffs'] as $b) {
    $bcopy = $b;
    $bcopy['seconds_left'] = max(0, ($b['expires'] - $now));
    unset($bcopy['expires']);
    $buffs[] = $bcopy;
  }
  return [
    'ok'      => true,
    'product' => $fk['product'],
    'stock'   => $fk['stock'],
    'boost'   => [
      'percent' => $fk['boost']['percent'],
      'buffs'   => $buffs,
    ],
  ];
}

function fk_add_inventory(int $qty, float $q): void {
  fk_boot();
  $qty  = max(0, intval($qty));
  $q    = max(0.0, min(1.0, floatval($q)));
  if ($qty <= 0) return;

  $units = $_SESSION['fk']['stock']['units'];
  $avgq  = $_SESSION['fk']['stock']['avg_q'];

  $total_units = $units + $qty;
  if ($total_units > 0) {
    $new_avg = (($avgq * $units) + ($q * $qty)) / $total_units;
  } else {
    $new_avg = $q;
  }
  $_SESSION['fk']['stock']['units'] = $total_units;
  $_SESSION['fk']['stock']['avg_q'] = round($new_avg, 4);
}

function fk_add_buff(string $id, string $label, int $minutes, float $trafficMult=1.0, float $qBonus=0.0): void {
  fk_boot();
  $minutes = max(1, intval($minutes));
  $_SESSION['fk']['boost']['buffs'][] = [
    'id'          => $id,
    'label'       => $label,
    'trafficMult' => floatval($trafficMult),
    'qBonus'      => floatval($qBonus),
    'expires'     => time() + $minutes * 60,
  ];
  fk_buff_cleanup_and_recalc();
}

function json_out(array $arr): void {
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}
