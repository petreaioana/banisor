<?php
// index.php — FinKids Tycoon: Dashboard (autosim, cu seed JSON pe disc)
declare(strict_types=1);
session_start();
require __DIR__ . '/game_assets/lib/jsonfs.php'; 

// 1) Endpoint snapshot din client (salvat pe disc în data/autosim/profile_autosave.json)
if (isset($_GET['action']) && $_GET['action'] === 'save') {
  header('Content-Type: application/json; charset=utf-8');
  $raw = file_get_contents('php://input');
  $ok = false;
  if ($raw !== false && strlen($raw) < 200000) {
    $data = json_decode($raw, true);
    if (is_array($data)) {
      // salvez direct pe disc
      $payload = [
        'lei'     => intval($data['lei'] ?? 0),
        'day'     => intval($data['day'] ?? 1),
        'progress'=> $data['progress'] ?? [],
        'meta'    => [ 'when' => intval($data['meta']['when'] ?? (time()*1000)) ]
      ];
      $ok = jsonfs_write('autosim/profile_autosave.json', $payload);
    }
  }
  echo json_encode(['ok'=>$ok]);
  exit;
}

// 2) Stare server implicită
$serverState = [
  'lei' => 500,
  'day' => 1,
  'world' => [
    'year'   => 1,
    'season' => 'primavara',
    'day'    => 1,
    'open'   => 8*60,
    'close'  => 8*60 + 8*60
  ],
  'economy2' => [ 'weather' => 'senin' ],
  'progress' => [ 'cookies' => ['day'=>1, 'profitBest'=>0] ],
  'meta'     => [ 'introSeen' => false, 'when' => time()*1000 ]
];

// 3) Dacă există seed salvat pe disc, îl folosim (preferabil față de sesiune/cookie)
$diskSeed = jsonfs_read('autosim/profile_autosave.json', null);
if (is_array($diskSeed)) {
  // doar câmpuri safe/folositoare pentru seed
  if (isset($diskSeed['lei'])) $serverState['lei'] = intval($diskSeed['lei']);
  if (isset($diskSeed['day'])) $serverState['day'] = intval($diskSeed['day']);
  if (isset($diskSeed['meta']['when'])) $serverState['meta']['when'] = intval($diskSeed['meta']['when']);
}
?>

<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FinKids Tycoon — Dashboard</title>

  <!-- Preload imagini de scenă -->
  <link rel="preload" as="image" href="dashboard_assets/images/shop_background.png" />

  <!-- Stiluri -->
  <link rel="stylesheet" href="dashboard_assets/styles/base.css" />
  <link rel="stylesheet" href="dashboard_assets/styles/dashboard.css" />

  <!-- Seed server (opțional; va fi folosit de FK în state.js) -->
  <script>
    window.__SERVER_STATE__ = <?php echo json_encode($serverState, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);?>;
  </script>

  <!-- Motor autosim (importă FK din dashboard_assets/js/shared/state.js) -->
  <script type="module" src="dashboard_assets/js/dashboard/engine.js" defer></script>

  <noscript><style>main, .layout { display:none; }</style></noscript>
</head>
<body>
  <!-- Topbar -->
  <header id="topbar" role="banner">
    <div class="left">
      <a class="brand" href="/">🍪 FinKids Tycoon</a>
      <span class="sep">•</span>
      <span id="day-clock">Ziua <b id="top-day">1</b> · <span id="top-time">08:00</span></span>
      <button id="btn-pause" class="btn" type="button">⏸️ Pauză</button>
      <div class="speed" aria-label="Control viteză simulare">
        Viteză:
        <button data-speed="0.5" class="btn speed-btn" type="button">0.5x</button>
        <button data-speed="1"   class="btn speed-btn active" type="button">1x</button>
        <button data-speed="2"   class="btn speed-btn" type="button">2x</button>
        <button data-speed="5"   class="btn speed-btn" type="button">5x</button>
        <button data-speed="20"  class="btn speed-btn" type="button">20x</button>
      </div>
    </div>
    <div class="right" aria-live="polite">
      💰 Lei: <b id="top-cash">0</b>
      <span class="sep">•</span>
      📦 Stoc: <b id="top-stock">0</b>
      <span class="sep">•</span>
      ⭐ R: <b id="top-rep">1.00</b>
      <span class="sep">•</span>
      ⚡ Boost: <b id="top-boost">0%</b>
      <span class="sep">•</span>
      <button id="btn-import-manual" class="btn">📥 Import Joc manual</button>

      <a class="btn" href="game.php">🎮 Joc manual</a>
    </div>
  </header>

  <!-- Layout 3 coloane -->
  <div class="layout">
    <!-- Coloana stângă: controale zi -->
    <aside id="left-controls">
      <h3 style="margin-top:0">Parametri zi (ajustabili în pauză)</h3>

      <!-- Selector produs + R&D sunt injectate din JS în partea de sus -->

      <div class="row">
        <label for="inp-price">Preț produs</label>
        <input id="inp-price" type="number" step="0.1" min="1" value="10">
        <input id="rng-price" type="range" step="0.1" min="1" max="100" value="10" aria-label="Slider preț">
      </div>

      <div class="row">
        <label for="inp-lot">Lot planificat (buc)</label>
        <input id="inp-lot" type="number" step="1" min="0" value="100">
      </div>

      <div class="row">
        <label>Happy Hour</label>
        <input id="inp-hh-start" type="time" value="16:00" aria-label="Happy Hour start">–
        <input id="inp-hh-end"   type="time" value="17:00" aria-label="Happy Hour final">
      </div>

      <div class="row">
        <label for="inp-hh-disc">Discount HH (%)</label>
        <input id="inp-hh-disc" type="number" step="1" min="5" max="25" value="10">
      </div>

      <div class="row">
        <label><input id="chk-flyer" type="checkbox"> Flyer local (+10% trafic, 2 zile) – 80 lei</label>
      </div>

      <div class="row">
        <label><input id="chk-social" type="checkbox"> Promo Social (+25% trafic, 1 zi) – 150 lei</label>
      </div>

      <div class="row">
        <label for="sel-cashiers">Personal la casă</label>
        <select id="sel-cashiers">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>

      <div class="row">
        <label>Upgrade-uri</label>
        <div class="grid">
          <label><input id="up-oven" type="checkbox"> Cuptor+</label>
          <label><input id="up-pos"  type="checkbox"> POS Rapid</label>
          <label><input id="up-auto" type="checkbox"> Timer Auto</label>
        </div>
      </div>

      <div class="hint">Orice schimbare devine activă după ce reiei simularea.</div>
      <hr>
      <div class="small muted">
        Butonul de <b>Ingrediente</b> și <b>Save slots</b> apar sus, în dreapta (montate din aplicație).
      </div>
    </aside>

    <!-- Coloana centrală: scenă -->
    <main id="center" role="main" aria-label="Scenă magazin">
      <div id="scene" class="scene scene-shop">
        <div id="ticker" class="order-ticket">Auto-sim activ…</div>
        <div id="banisor-corner" class="banisor-counter" aria-label="Mascota Banisor"></div>
      </div>
    </main>

    <!-- Coloana dreaptă: metrici live -->
    <aside id="right-metrics" aria-live="polite">
      <h3 style="margin-top:0">Metrici live</h3>

      <div class="metric">
        <div class="label">Q medie</div>
        <div class="bar"><span id="bar-q" style="width:70%"></span></div>
      </div>

      <div class="metric">
        <div class="label">W (min)</div>
        <div class="bar warn"><span id="bar-w" style="width:20%"></span></div>
      </div>

      <div class="metric">
        <div class="label">Conversie</div>
        <div class="bar"><span id="bar-c" style="width:40%"></span></div>
      </div>

      <div class="metric">
        <div class="label">Clienți/zi</div>
        <div class="bar"><span id="bar-n" style="width:30%"></span></div>
      </div>

      <div class="panel soft">
        <div class="row tight"><span>Vândute azi:</span><b id="m-sold">0</b></div>
        <div class="row tight"><span>Venituri azi:</span><b id="m-rev">0</b> lei</div>
        <div class="row tight"><span>Profit azi:</span><b id="m-prof">0</b> lei</div>
      </div>

      <!-- Cardurile Sezon, Evenimente și Quests se montează din JS aici -->
    </aside>
  </div>

  <!-- Bara stații jos -->
  <footer id="stationbar" role="contentinfo">
    <div class="station active">Auto-Sim</div>
    <a class="station" href="game.php">Joc Manual</a>
    <div class="station">Raport</div>
  </footer>

  <noscript>Este nevoie de JavaScript pentru a rula simulatorul.</noscript>
</body>
</html>
