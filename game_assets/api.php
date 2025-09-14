<?php
/**
 * FinKids Tycoon — API Router (JSON)
 * Endpoints:
 *  - GET  ?action=state  → starea curentă (product, stock, boost)
 *  - POST ?action=serve  → adaugă inventar + buff "Coacere perfectă" dacă inWin=1
 *  - GET  ?action=reset  → curăță sesiunea FK
 *
 * Dependențe:
 *  - require game_assets/lib/fk.php (funcțiile FK + json_out)
 *
 * Folosit de:
 *  - game_assets/js/game.js (via fetch('game_assets/api.php?...'))
 */

require __DIR__ . '/lib/fk.php';

$action = $_GET['action'] ?? null;

if ($action === 'state') {
  json_out(fk_state_response());
}

if ($action === 'serve' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  fk_boot();
  $qty   = isset($_POST['qty']) ? intval($_POST['qty']) : 0;
  $q     = isset($_POST['q'])   ? floatval($_POST['q']) : 0.90;
  $inWin = isset($_POST['inWin']) ? (intval($_POST['inWin'])===1) : false;

  fk_add_inventory($qty, $q);
  if ($inWin) {
    // Small buff when bake stopped in the "green" window
    fk_add_buff('freshBake', 'Coacere perfectă', 45, 1.08, 0.02);
  }
  json_out([
    'ok'    => true,
    'state' => fk_state_response()
  ]);
}

if ($action === 'reset') {
  unset($_SESSION['fk']);
  json_out([ 'ok' => true, 'msg' => 'reset done' ]);
}
// ... în routerul existent din game.php, sub 'reset'
if ($action === 'export') {
  fk_boot();
  fk_buff_cleanup_and_recalc();
  $fk = $_SESSION['fk'];

  $now = time();
  $buffs = [];
  foreach ($fk['boost']['buffs'] as $b) {
    $buffs[] = [
      'id'          => $b['id'] ?? 'buff',
      'label'       => $b['label'] ?? 'Boost',
      'trafficMult' => isset($b['trafficMult']) ? floatval($b['trafficMult']) : 1.0,
      'qBonus'      => isset($b['qBonus']) ? floatval($b['qBonus']) : 0.0,
      'seconds_left'=> max(0, ($b['expires'] ?? $now) - $now),
    ];
  }

  $transfer = [
    'qty'   => intval($fk['stock']['units'] ?? 0),
    'avg_q' => floatval($fk['stock']['avg_q'] ?? 0.86),
    'buffs' => $buffs
  ];

  // dacă vrei import "o singură dată": ?action=export&clear=1
  $shouldClear = isset($_GET['clear']) && intval($_GET['clear']) === 1;
  if ($shouldClear) {
    $_SESSION['fk']['stock']['units'] = 0;
    // opțional: curăță și boost-urile pentru a nu le importa de 2 ori
    $_SESSION['fk']['boost']['buffs'] = [];
    $_SESSION['fk']['boost']['percent'] = 0;
  }

  json_out(['ok'=>true,'transfer'=>$transfer]);
}

// Unknown
http_response_code(404);
json_out([ 'ok' => false, 'error' => 'unknown action' ]);
