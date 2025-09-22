<?php
// app/controllers/AtelierController.php
declare(strict_types=1);

class AtelierController
{
  public function index() {
    $cfg = require __DIR__.'/../config.php';
    $pid = (int)$cfg['profile_id'];

    // status pentru topbar
    $product = ProductModel::activeForProfile($pid);
    $stock   = InventoryModel::totalStock($pid, $product['id'] ?? null);

    // boost agregat (percent) din buffs active (idle)
    $boostPct = BuffModel::aggregatePercent($pid);

    view('atelier/index.php', compact('product','stock','boostPct'));
  }

  // primește scorurile de la client (POST)
  public function serve() {
    if ($_SERVER['REQUEST_METHOD']!=='POST') { http_response_code(405); exit('405'); }
    if (!csrf_check()) { http_response_code(400); exit('CSRF'); }

    $cfg = require __DIR__.'/../config.php';
    $pid = (int)$cfg['profile_id'];

    // sanitizare
    $qty = max(0, min(24, (int)($_POST['qty'] ?? 0)));  // cap rezonabil pe buff batch
    $q   = (float)($_POST['q'] ?? 0.86);
    $q   = max(0.70, min(0.98, $q));

    // mic anti-spam: nu accepta 0 sau valori nevalide
    if ($qty <= 0) {
      redirect('?r=atelier.index&err=qty');
      return;
    }

    $inWin = (int)($_POST['inwin'] ?? 0) === 1;
    TransferModel::add($pid, $qty, $q, $inWin);

    // feedback
    redirect('?r=atelier.index&ok=served&add='.$qty.'&q='.number_format($q,2));
  }

  public function reset() {
    $cfg = require __DIR__.'/../config.php';
    $pid = (int)$cfg['profile_id'];
    TransferModel::clear($pid);
    redirect('?r=atelier.index&ok=reset');
  }
}
