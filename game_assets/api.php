<?php
/**
 * FinKids Tycoon — API Router (JSON) pentru jocul manual + punte JSON
 * Endpoints:
 *  - GET  ?action=state
 *  - POST ?action=serve     (acum și acumulează într-un fișier JSON transferul pt. autosim)
 *  - GET  ?action=reset
 *  - GET  ?action=export    (snapshot sesiune manuală; opțional &clear=1)
 *  - GET  ?action=fetch_transfer [&clear=1]  (citesc/șterg transferul din fișier)
 */

declare(strict_types=1);

require __DIR__ . '/lib/fk.php';
require __DIR__ . '/lib/jsonfs.php'; // ✅ CORECTAT

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? null;

/** UTIL: cale fișier transfer cumulativ manual→autosim */
function _transfer_file(): string {
  // data/transfers/manual_to_auto.json
  return 'transfers/manual_to_auto.json';
}

/** UTIL: citește transfer curent (qty total, avg_q agregat, buffs[] cu expires) */
function transfer_read(): array {
  $def = ['qty' => 0, 'avg_q' => 0.86, 'buffs' => []];
  $t = jsonfs_read(_transfer_file(), $def);
  if (!is_array($t)) $t = $def;
  $t['qty']   = intval($t['qty'] ?? 0);
  $t['avg_q'] = floatval($t['avg_q'] ?? 0.86);
  $t['buffs'] = is_array($t['buffs'] ?? null) ? $t['buffs'] : [];
  return $t;
}

/** UTIL: scrie transfer */
function transfer_write(array $t): bool {
  $t['qty']   = max(0, intval($t['qty'] ?? 0));
  $t['avg_q'] = max(0.0, min(1.0, floatval($t['avg_q'] ?? 0.86)));
  $t['buffs'] = array_values(array_filter($t['buffs'] ?? [], function($b){
    return is_array($b);
  }));
  return jsonfs_write(_transfer_file(), $t);
}

/** UTIL: adaugă producție la transfer (recalculează media ponderată) + buff dacă inWin */
function transfer_add(int $qty, float $q, bool $inWin): void {
  $qty = max(0, $qty);
  $q   = max(0.0, min(1.0, $q));
  if ($qty <= 0) return;

  $t = transfer_read();
  $oldQty = intval($t['qty'] ?? 0);
  $oldAvg = floatval($t['avg_q'] ?? 0.86);
  $newQty = $oldQty + $qty;
  $newAvg = $newQty > 0 ? (($oldAvg * $oldQty) + ($q * $qty)) / $newQty : $q;

  $t['qty']   = $newQty;
  $t['avg_q'] = round($newAvg, 4);

  if ($inWin) {
    $t['buffs'] = $t['buffs'] ?? [];
    $t['buffs'][] = [
      'id'          => 'freshBake',
      'label'       => 'Coacere perfectă',
      'trafficMult' => 1.08,
      'qBonus'      => 0.02,
      'expires'     => time() + 45 * 60, // 45 minute de la momentul servirii
    ];
  }

  transfer_write($t);
}

/** UTIL: construiește payloadul transfer pt. client (cu seconds_left) */
function transfer_payload(array $t): array {
  $now = time();
  $buffs = [];
  foreach ($t['buffs'] as $b) {
    $buffs[] = [
      'id'           => $b['id']    ?? 'buff',
      'label'        => $b['label'] ?? 'Boost',
      'trafficMult'  => isset($b['trafficMult']) ? floatval($b['trafficMult']) : 1.0,
      'qBonus'       => isset($b['qBonus']) ? floatval($b['qBonus']) : 0.0,
      'seconds_left' => max(0, (intval($b['expires'] ?? $now) - $now)),
    ];
  }
  return [
    'qty'   => intval($t['qty'] ?? 0),
    'avg_q' => floatval($t['avg_q'] ?? 0.86),
    'buffs' => $buffs
  ];
}

// =====================================================
// ROUTER
// =====================================================

if ($action === 'state') {
  echo json_encode(fk_state_response(), JSON_UNESCAPED_UNICODE);
  exit;
}

if ($action === 'serve' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  fk_boot();
  $qty   = isset($_POST['qty']) ? intval($_POST['qty']) : 0;
  $q     = isset($_POST['q'])   ? floatval($_POST['q']) : 0.90;
  $inWin = isset($_POST['inWin']) ? (intval($_POST['inWin'])===1) : false;

  // sesiune manuală (pentru jocul manual)
  fk_add_inventory($qty, $q);
  if ($inWin) {
    fk_add_buff('freshBake', 'Coacere perfectă', 45, 1.08, 0.02);
  }

  // ➕ ACUMULARE ÎN FIȘIER PENTRU AUTOSIM
  transfer_add($qty, $q, $inWin);

  echo json_encode([
    'ok'    => true,
    'state' => fk_state_response()
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($action === 'reset') {
  unset($_SESSION['fk']);
  // opțional poți goli și transferul, dar îl lăsăm separat
  echo json_encode([ 'ok' => true, 'msg' => 'reset done' ], JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * Export sesiune manuală (legacy) — rămâne pentru debug.
 * Poate șterge stocul/buff-urile din sesiune cu &clear=1
 */
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

  // legacy: golește sesiunea la cerere
  $shouldClear = isset($_GET['clear']) && intval($_GET['clear']) === 1;
  if ($shouldClear) {
    $_SESSION['fk']['stock']['units'] = 0;
    $_SESSION['fk']['boost']['buffs'] = [];
    $_SESSION['fk']['boost']['percent'] = 0;
  }

  echo json_encode(['ok'=>true,'transfer'=>$transfer], JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * NOU: fetch_transfer — citește transferul din FIȘIER (manual → autosim)
 * GET ?action=fetch_transfer [&clear=1]
 */
if ($action === 'fetch_transfer') {
  $t = transfer_read();
  // Curăță buff-urile expirate
  $now = time();
  $t['buffs'] = array_values(array_filter($t['buffs'], function($b) use ($now){
    return intval($b['expires'] ?? 0) > $now;
  }));
  $payload = transfer_payload($t);

  $shouldClear = isset($_GET['clear']) && intval($_GET['clear']) === 1;
  if ($shouldClear) {
    transfer_write(['qty'=>0,'avg_q'=>0.86,'buffs'=>[]]);
  }

  echo json_encode(['ok'=>true, 'transfer'=>$payload], JSON_UNESCAPED_UNICODE);
  exit;
}

// Unknown
http_response_code(404);
echo json_encode([ 'ok' => false, 'error' => 'unknown action' ], JSON_UNESCAPED_UNICODE);
