<?php
class DashboardController {
public function index() {
  $cfg = require __DIR__.'/../config.php';
  $pid = (int)$cfg['profile_id'];

  // rulează 1 “batch” de minute pe request (speed respectat)
  Autosim::runTick($pid);

  $profile = ProfileModel::getActive();
  $product = ProductModel::activeForProfile($pid);
  $stock   = InventoryModel::totalStock($pid, $product['id'] ?? null);
  $boost   = BuffModel::aggregatePercent($pid);

  // citește agregatele curente pentru card
  $agg = pdo()->prepare("SELECT * FROM fk_autosim_agg_current WHERE profile_id=?");
  $agg->execute([$pid]); $agg = $agg->fetch() ?: ['sold'=>0,'rev'=>0,'cogs'=>0,'N'=>0,'C'=>0,'W'=>0,'Q'=>0];

  view('dashboard/index.php', compact('profile','product','stock','boost','agg','cfg'));
}


  // Importă din atelier: mută transferul în inventar + creează buff-uri și golește transferul
  public function importFromAtelier() {
    $cfg = require __DIR__.'/../config.php';
    $pid = (int)$cfg['profile_id'];

    $product = ProductModel::activeForProfile($pid);
    $transfer = TransferModel::read($pid);

    if (($transfer['qty'] ?? 0) > 0 && !empty($product['id'])) {
      InventoryModel::addLot($pid, (int)$product['id'], (int)$transfer['qty'], (float)$transfer['avg_q']);
    }
    // aplică buff-urile
    foreach ($transfer['buffs'] as $b) {
      BuffModel::addTimed($pid, $b['label'] ?? 'Boost', (float)($b['trafficMult'] ?? 1.0), (float)($b['qBonus'] ?? 0.0), 0.0, (int)($b['minutes'] ?? 45));
    }
    TransferModel::clear($pid);
    redirect('?r=dashboard.index&ok=import');
  }

  public function updateSettings() {
    if (!csrf_check()) { http_response_code(400); exit('CSRF'); }
    $cfg = require __DIR__.'/../config.php';
    $pid = (int)$cfg['profile_id'];
    $productId = (int)post('product_id');

    ProductModel::updateSettings($pid, $productId, [
      'price'       => (float)post('price', 10),
      'planned_qty' => (int)post('planned_qty', 100),
      'hh_enabled'  => (int)!!post('hh_enabled', 1),
      'hh_start'    => post('hh_start','16:00'),
      'hh_end'      => post('hh_end','17:00'),
      'hh_disc'     => (int)post('hh_disc', 10),
    ]);
    redirect('?r=dashboard.index&ok=save');
  }
  public function pause(){ $this->toggleRun(0); }
public function play() { $this->toggleRun(1); }
private function toggleRun(int $run){
  $cfg = require __DIR__.'/../config.php'; $pid=(int)$cfg['profile_id'];
  pdo()->prepare("UPDATE fk_profiles SET autosim_running=?, last_tick_at=NOW() WHERE id=?")->execute([$run,$pid]);
  redirect('?r=dashboard.index&ok=' . ($run?'play':'pause'));
}
public function speed(){
  if (!csrf_check()) { http_response_code(400); exit('CSRF'); }
  $cfg = require __DIR__.'/../config.php'; $pid=(int)$cfg['profile_id'];
  $sp = max(1, min(20, (int)post('speed',1)));
  pdo()->prepare("UPDATE fk_profiles SET autosim_speed=? WHERE id=?")->execute([$sp,$pid]);
  redirect('?r=dashboard.index&ok=speed');
}

}
