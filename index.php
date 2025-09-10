<?php
session_start();

// Lightweight persistence endpoint (optional). Saves daily snapshot.
if (isset($_GET['action']) && $_GET['action'] === 'save') {
  header('Content-Type: application/json; charset=utf-8');
  $raw = file_get_contents('php://input');
  $ok = false;
  if ($raw !== false && strlen($raw) < 20000) {
    $data = json_decode($raw, true);
    if (is_array($data)) {
      $_SESSION['fk_profile'] = $data;
      @setcookie('fk_profile', json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), time()+31536000, '/', '', false, true);
      $ok = true;
    }
  }
  echo json_encode(['ok'=>$ok]);
  exit;
}

$serverState = [
  'lei' => 500,
  'day' => 1,
  'progress' => ['cookies'=>['day'=>1, 'profitBest'=>0]],
  'meta' => ['introSeen'=>false]
];
if (!empty($_SESSION['fk_profile']) && is_array($_SESSION['fk_profile'])) {
  $serverState = array_replace_recursive($serverState, $_SESSION['fk_profile']);
} elseif (!empty($_COOKIE['fk_profile'])) {
  $cookie = json_decode((string)$_COOKIE['fk_profile'], true);
  if (is_array($cookie)) $serverState = array_replace_recursive($serverState, $cookie);
}
?>
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FinKids Tycoon — COMBINED</title>
  <link rel="preload" as="image" href="shop_background.png" />
  <link rel="preload" as="image" href="kitchen_background.png" />
  <link rel="preload" as="image" href="worktop_background.png" />
  <link rel="stylesheet" href="combined.css" />
  <script>
    window.__SERVER_STATE__ = <?php echo json_encode($serverState, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);?>;
  </script>
  <script defer src="combined.js"></script>
  <noscript><style>main{display:none}</style></noscript>
</head>
<body>
  <!-- Top control bar: time, pause, speed, cash, stock, reputation -->
  <header id="topbar">
    <div class="left">
      <span class="brand">🍪 FinKids Tycoon</span>
      <span class="sep">•</span>
      <span id="day-clock">Ziua <b id="top-day">1</b> · <span id="top-time">08:00</span></span>
      <button id="btn-pause" class="btn">⏸️ Pauză</button>
      <div class="speed">
        Viteză:
        <button data-speed="0.5" class="btn speed-btn">0.5×</button>
        <button data-speed="1" class="btn speed-btn active">1×</button>
        <button data-speed="2" class="btn speed-btn">2×</button>
        <button data-speed="5" class="btn speed-btn">5×</button>
        <button data-speed="20" class="btn speed-btn">20×</button>
      </div>
    </div>
    <div class="right">
      💰 Lei: <b id="top-cash">0</b>
      <span class="sep">•</span>
      📦 Stoc: <b id="top-stock">0</b>
      <span class="sep">•</span>
      ⭐ R: <b id="top-rep">1.00</b>
      <span class="sep">•</span>
      ⚡ Boost: <b id="top-boost">0%</b>
    </div>
  </header>

  <!-- Main layout: left controls (pausable), center scene, right metrics -->
  <div class="layout">
    <aside id="left-controls">
      <h3>Parametri zi (ajustabili în pauză)</h3>
      <div class="row">
        <label>Preț Croissant</label>
        <input id="inp-price" type="number" step="0.1" min="7" max="13" value="10">
        <input id="rng-price" type="range" step="0.1" min="7" max="13" value="10">
      </div>
      <div class="row">
        <label>Lot planificat (buc)</label>
        <input id="inp-lot" type="number" step="1" min="0" value="100">
      </div>
      <div class="row">
        <label>Happy Hour</label>
        <input id="inp-hh-start" type="time" value="16:00">–<input id="inp-hh-end" type="time" value="17:00">
      </div>
      <div class="row">
        <label>Discount HH (%)</label>
        <input id="inp-hh-disc" type="number" step="1" min="5" max="20" value="10">
      </div>
      <div class="row">
        <label><input id="chk-flyer" type="checkbox"> Flyer local (+10% trafic, 2 zile) – 80 lei</label>
      </div>
      <div class="row">
        <label><input id="chk-social" type="checkbox"> Promo Social (+25% trafic, 1 zi) – 150 lei</label>
      </div>
      <div class="row">
        <label>Personal la casă</label>
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
          <label><input id="up-pos" type="checkbox"> POS Rapid</label>
          <label><input id="up-auto" type="checkbox"> Timer Auto</label>
        </div>
      </div>
      <div class="hint">Orice schimbare devine activă după ce reiei simularea.</div>
      <hr>
      <button id="btn-arcade" class="btn wide">🎮 Arcade (manual biscuit)</button>
      <div class="small muted">Finalizează cu succes mini-jocul pentru a primi un ⚡ boost temporar la calitate & coadă în auto-sim.</div>
      <div class="row"></div>
      <button id="btn-prep" class="btn wide">Preparare manuală (ingrediente)</button>
    </aside>

    <main id="center">
      <!-- Scene stack: background artwork from joculet 1 -->
      <div id="scene" class="scene scene-shop">
        <div class="overlay-intro" id="intro">
          <div class="modal">
            <h2>Bine ai venit!</h2>
            <p>Acesta este modul COMBINED: un simulator care rulează non-stop pe fundal (auto-sim) + un mini-joc manual (arcade) ce îți dă boost.</p>
            <ul>
              <li>Apasă <b>Pauză</b> ca să ajustezi parametrii.</li>
              <li>Folosește <b>Viteză</b> pentru a comprima timpul.</li>
              <li>🎮 Arcade îți oferă <b>boost</b> ce crește <i>Q</i> și reduce <i>W</i> în auto-sim.</li>
            </ul>
            <div class="footer">
              <label><input id="chk-show-help" checked type="checkbox"> Arată sfaturi la pornire</label>
              <button id="btn-start" class="btn">Start</button>
            </div>
          </div>
        </div>
        <div id="ticker" class="order-ticket">Auto-sim activ…</div>
        <div id="banisor-corner" class="banisor-counter"></div>
      </div>
    </main>

    <aside id="right-metrics">
      <h3>Metrici live</h3>
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
    </aside>
  </div>

  <!-- Arcade modal (manual mini-game) -->
  <div id="arcade-modal" class="modal-overlay" hidden>
    <div class="modal wide">
      <h2>🎮 Arcade — Coace perfect tava!</h2>
      <p>Așteaptă ca bara să intre în zona verde și apasă <b>SPAȚIU</b> pentru a scoate tava. Reușita îți dă ⚡ boost pentru auto-sim.</p>
      <div id="arcade-root">
        <div class="oven-animation-container">
          <img class="oven-image" id="arc-oven" src="oven_open.png" alt="Cuptor">
          <div class="baking-tray" id="arc-tray">
            <img class="cookie-on-tray" id="arc-cookie" src="cookie_bake_plain.png" alt="Biscuite">
          </div>
        </div>
        <div class="progress-container"><div class="progress-bar" id="arc-bar"></div></div>
        <div class="hit-window"><span></span></div>
      </div>
      <div class="footer">
        <button id="btn-arc-close" class="btn secondary">Închide</button>
      </div>
    </div>
  </div>

  <!-- Prep modal (ingredient-based manual prep) -->
  <div id="prep-modal" class="modal-overlay" hidden>
    <div class="modal wide">
      <h2>Preparare manuală — Biscuiți cu ingrediente</h2>
      <p>Alege ingrediente și “coace” tava. Vei primi stoc proaspăt și un mic boost la calitate.</p>
      <div id="prep-root" class="prep-root">
        <div id="prep-palette" class="prep-palette"></div>
        <div class="prep-work">
          <div class="cookie-stage">
            <img id="prep-cookie" class="prep-cookie" src="cookie_bake_plain.png" alt="Bază biscuite">
            <div id="prep-toppings" class="prep-toppings"></div>
          </div>
        </div>
        <div class="prep-summary">
          <div class="summary-box">
            <h3>Rețetă curentă</h3>
            <ul id="prep-list" class="prep-list"></ul>
          </div>
          <div class="footer">
            <div>
              <button id="btn-prep-reset" class="btn secondary">Reset</button>
            </div>
            <div>
              <button id="btn-prep-bake" class="btn">Coace</button>
              <button id="btn-prep-close" class="btn secondary">Închide</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <footer id="stationbar">
    <div class="station active">Auto-Sim</div>
    <div class="station">Raport</div>
    <div class="station">Magazine</div>
  </footer>

  <noscript>
    Este nevoie de JavaScript pentru a rula simulatorul.
  </noscript>
</body>
</html>

