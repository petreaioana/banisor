<?php
// ===============================================
// FinKids Tycoon — game.php (all-in-one)
// - PHP session holds "FK-like" state (stock, product, buffs)
// - API endpoints in same file: ?action=state | serve | reset
// - No ingredient checks on serve (per request)
// ===============================================
session_start();

function fk_boot() {
  if (!isset($_SESSION['fk'])) {
    $_SESSION['fk'] = [
      'product' => [ 'key' => 'cupcake', 'name' => 'Brioșă' ],
      'stock'   => [ 'units' => 0, 'avg_q' => 0.90 ],
      'boost'   => [ 'percent' => 0, 'buffs' => [] ], // percent = (mult-1)*100
    ];
  }
}
function fk_buff_cleanup_and_recalc() {
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
function fk_state_response() {
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
function fk_add_inventory($qty, $q) {
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
function fk_add_buff($id, $label, $minutes, $trafficMult=1.0, $qBonus=0.0) {
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
function json_out($arr) {
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

// ---------- API router ----------
if (isset($_GET['action'])) {
  $action = $_GET['action'];

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

  // Unknown
  http_response_code(404);
  json_out([ 'ok' => false, 'error' => 'unknown action' ]);
}

// ---------- Page (no action): render full UI ----------
fk_boot();
?><!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FinKids Tycoon — Joc manual (PHP One-File)</title>
  <meta name="color-scheme" content="light only" />
  <style>
    :root{
      --frame: #c8a662;
      --border-2:#e6dfca;
      --brand:#ffd86f;
      --brand-2:#ffd86f;
      --paper:#fcfaf2;
      --ink:#222;
      --bg:#fffef7;
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,sans-serif;background:#fffdf6;color:#222}
    a{color:inherit}
    .btn{display:inline-flex;align-items:center;gap:.4rem;background:#ffe38d;border:2px solid #c8a662;border-radius:10px;padding:.45rem .7rem;font-weight:700;cursor:pointer}
    .btn.secondary{background:#fff;border-color:#d9cfb5}
    .btn[disabled]{opacity:.5;pointer-events:none}
    .btn.wide{width:100%;justify-content:center}
    .row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}
    .small{font-size:.9rem}
    .muted{opacity:.7}
    .panel{background:#fff;border:1px dashed #e1d4b0;border-radius:10px;padding:.6rem}
    header#topbar{position:sticky;top:0;z-index:999;background:#fffef7;border-bottom:2px solid var(--frame);display:flex;justify-content:space-between;align-items:center;padding:.4rem .6rem}
    header .brand{font-weight:900;text-decoration:none}
    header .sep{opacity:.4;margin:0 .4rem}
    /* Stepper */
    #stepper{position:sticky;top:48px;z-index:900;background:linear-gradient(180deg, rgba(253,210,110,.95), rgba(253,210,110,.6));border-bottom:2px solid var(--frame)}
    #stepper ol{list-style:none;margin:0;padding:.35rem .75rem;display:flex;gap:.5rem;overflow:auto}
    #stepper li{background:#fffef7;border:2px solid var(--frame);border-radius:999px;padding:.28rem .7rem;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:.35rem;opacity:.85}
    #stepper li.active{background:var(--brand-2);outline:2px solid #000;opacity:1}
    #stepper li.done{background:#dff6df;border-color:#9ed39e}
    /* Layout */
    .game-layout{display:grid;grid-template-columns:320px 1fr 380px;gap:12px;padding:12px;min-height:calc(100vh - 56px - 40px)}
    .game-panel{background:#fffef7;border:2px solid #e1d4b0;border-radius:12px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
    .order-card{background:#fffbee;border:1px dashed #e1d4b0;border-radius:10px;padding:8px}
    .order-card .tops{margin:.25rem 0 .25rem 1rem}
    /* Canvas */
    .build-stage{position:relative;height:320px;background:#fff;border:2px dashed var(--border-2);border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;isolation:isolate}
    .shape{--mold-size:200px;position:relative;width:var(--mold-size);height:var(--mold-size);filter:drop-shadow(0 2px 6px rgba(0,0,0,.15))}
    .shape--circle{border-radius:999px;clip-path:circle(50% at 50% 50%)}
    .shape--heart{clip-path:polygon(50% 85%, 20% 60%, 12% 40%, 20% 25%, 35% 20%, 50% 30%, 65% 20%, 80% 25%, 88% 40%, 80% 60%)}
    .shape--star{clip-path:polygon(50% 5%, 61% 38%, 95% 38%, 67% 57%, 78% 90%, 50% 70%, 22% 90%, 33% 57%, 5% 38%, 39% 38%)}
    .shape-base{position:absolute;inset:0;background:radial-gradient(100% 100% at 50% 40%, #ffe7b3 0%, #ffd37a 55%, #f7b74d 100%);border:3px solid #b77a21;box-shadow:inset 0 6px 12px rgba(0,0,0,.08)}
    .shape-fill{position:absolute;left:0;bottom:0;width:100%;height:0%;background:repeating-linear-gradient(180deg, #f7c66a 0 6px, #f2b85a 6px 12px);border-top:1px solid rgba(0,0,0,.08);transition:height .15s ease}
    .shape-fill.good{box-shadow:0 0 0 2px #6ad16f inset, 0 0 12px rgba(106,209,111,.5) inset}
    .build-dropzone{position:absolute;inset:0;pointer-events:auto}
    .hidden{display:none !important}
    .canvas-controls{margin-top:10px;background:#fffbee;border:1px dashed #e1d4b0;border-radius:10px;padding:8px}
    /* Palette / chips */
    .palette{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
    .chip-btn{display:flex;align-items:center;gap:6px;padding:.35rem .45rem;border:1px solid var(--border-2);border-radius:10px;background:#fffef7;cursor:grab;user-select:none}
    .chip-btn i{display:inline-block;width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(0,0,0,.1)}
    i[data-type="chocolate_chips"]{background:radial-gradient(circle at 60% 40%, #6a3b1e, #4b2813)}
    i[data-type="strawberries"]{background:radial-gradient(circle at 60% 40%, #ff6b6b, #d23b3b)}
    i[data-type="coconut"]{background:linear-gradient(45deg, #fff, #f3f3f3)}
    i[data-type="sprinkles"]{background:#ffeea8;background-image:radial-gradient(#ff5b5b 2px, transparent 2px),radial-gradient(#5bb8ff 2px, transparent 2px),radial-gradient(#76e27a 2px, transparent 2px),radial-gradient(#f1aaff 2px, transparent 2px);background-size:10px 10px; background-position:0 0, 3px 7px, 7px 3px, 5px 0px}
    i[data-type="cacao"]{background:linear-gradient(45deg, #5a341c, #3b220f)}
    i[data-type="sugar"]{background:repeating-linear-gradient(45deg, #fff, #fff 4px, #f2f2f2 4px, #f2f2f2 8px)}
    .chip{position:absolute;width:30px;height:30px;border-radius:50%;cursor:move;user-select:none;touch-action:none;box-shadow:0 1px 3px rgba(0,0,0,.2), inset 0 0 0 2px rgba(255,255,255,.6);animation:chipPop .18s ease-out both}
    @keyframes chipPop{from{transform:scale(.7);opacity:.2}to{transform:scale(1);opacity:1}}
    /* Bake */
    .oven img{width:100%;max-width:320px;display:block;margin:0 auto}
    .progress-container{width:90%;height:20px;background:var(--paper);border:2px solid var(--frame);border-radius:10px;margin:8px auto}
    .progress-bar{height:100%;width:0;background:var(--brand);border-radius:10px;transition:width .08s;position:relative;overflow:hidden}
    .hit-window{width:90%;height:16px;border:1px dashed #999;margin:0 auto;border-radius:10px;position:relative}
    .hit-window span{position:absolute;left:55%;width:10%;height:100%;background:#88d18a;opacity:.45;border-radius:10px}
    #oven-img.shake{animation:shake .35s ease-in-out}
    @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-2px)}40%{transform:translateX(2px)}60%{transform:translateX(-1px)}80%{transform:translateX(1px)}}
    /* Toast & particles */
    .particle{position:absolute;width:8px;height:8px;border-radius:50%;pointer-events:none;opacity:.9}
    @keyframes pop{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.6) translate(var(--dx),var(--dy));opacity:0}}
    .toast-container{position:fixed;top:12px;right:12px;z-index:100000;display:flex;flex-direction:column;gap:8px}
    .toast{background:#222;color:#fff;padding:8px 12px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.3);opacity:.95}
    footer.game-footer{display:flex;justify-content:space-between;align-items:center;padding:.6rem 1rem}
    @media (max-width:1100px){.game-layout{grid-template-columns:300px 1fr}.game-panel:last-child{order:3}.build-stage{height:300px}.palette{grid-template-columns:repeat(3,1fr)}}
    @media (max-width:860px){.game-layout{grid-template-columns:1fr}.build-stage{height:280px}}
  /* --- CHIP (topping ca imagine) --- */
.chip{
  position:absolute;
  width:44px;               /* a fost 30px — un pic mai mare arată mai bine */
  height:44px;
  border-radius:8px;        /* puțin rotunjit; imaginile au transparență */
  cursor:move;
  user-select:none;
  touch-action:none;
  box-shadow:0 1px 3px rgba(0,0,0,.25), 0 0 0 2px rgba(255,255,255,.6) inset;
  animation:chipPop .18s ease-out both;
}
.chip img{
  width:100%;
  height:100%;
  object-fit:contain;
  pointer-events:none;      /* permite drag pe containerul .chip */
}

/* --- PALETĂ (iconițe din imagini, nu <i> cu background) --- */
.chip-btn{
  display:flex; align-items:center; gap:6px;
  padding:.35rem .45rem; border:1px solid var(--border-2);
  border-radius:10px; background:#fffef7; cursor:grab; user-select:none;
}
.chip-btn img{
  width:22px; height:22px; object-fit:contain; display:inline-block;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.05));
}

  </style>
</head>
<body>
  <!-- Topbar -->
  <header id="topbar" role="banner" aria-label="Bară de navigare joc">
    <div class="left">
      <a class="brand" href="index.php">🍪 FinKids Tycoon</a>
      <span class="sep">•</span>
      <button id="btn-audio" class="btn secondary" aria-pressed="true" title="Sunet ON/OFF">🔊 Sunet</button>
      <span class="sep">•</span>
      <button id="btn-reset" class="btn secondary" title="Reset sesiune">♻️ Reset</button>
    </div>
    <div class="right" aria-live="polite">
      📦 Stoc: <b id="g-stock">0</b>
      <span class="sep">•</span>
      ⚡ Boost: <b id="g-boost">0%</b>
    </div>
  </header>

  <!-- Stepper -->
  <nav id="stepper" aria-label="Etape joc">
    <ol>
      <li data-phase="pour"     class="active">🫙 Turnare</li>
      <li data-phase="decorate">🍬 Decor</li>
      <li data-phase="bake">🔥 Coacere</li>
      <li data-phase="serve">🧁 Servire</li>
    </ol>
  </nav>

  <!-- Content -->
  <main class="game-layout" role="main">
    <!-- Left: Order -->
    <section class="game-panel" aria-labelledby="h-order">
      <h3 id="h-order">Comandă curentă</h3>
      <div id="order-card" class="order-card" aria-live="polite">
        <div class="row tight">
          <div><b>Formă:</b> <span id="ord-shape">Cerc</span></div>
          <div><b>Mărime:</b> <span id="ord-size">M</span></div>
        </div>
        <div style="margin-top:.25rem"><b>Toppinguri cerute:</b>
          <ul id="ord-tops" class="tops"></ul>
        </div>
        <div style="margin-top:.25rem"><b>Țintă coacere:</b>
          <span id="ord-bake">-</span>
        </div>
      </div>
      <div class="row" style="margin-top:.5rem">
        <button id="btn-new-order" class="btn wide" title="Generează o comandă nouă">🔄 Comandă nouă</button>
      </div>
      <hr>
      <div class="panel soft small">
        <b>Tips de la Bănișor:</b>
        <ul style="margin:.25rem 0 .25rem 1.2rem">
          <li>Umple forma până la dungulița verde.</li>
          <li>Pune toppingurile cerute, răspândite frumos.</li>
          <li>Oprește cuptorul în fereastra verde pentru bonus ✨.</li>
        </ul>
      </div>
      <hr>
      <div class="panel soft small">
        <div>Scor turnare: <b id="score-pour">0</b>/100</div>
        <div>Scor decor: <b id="score-top">0</b>/100</div>
        <div>Scor coacere: <b id="score-bake">0</b>/100</div>
        <div>Calitate Q: <b id="score-q">0.00</b></div>
        <div>Cantitate: <b id="score-qty">0</b> buc</div>
      </div>
    </section>

    <!-- Center: Canvas + tools -->
    <section class="game-panel" aria-labelledby="h-canvas">
      <h3 id="h-canvas">Stație de lucru</h3>
      <!-- Precompiled canvas (no dynamic creation) -->
      <div class="build-stage" aria-live="polite" aria-label="Zonă de lucru prăjitură">
        <div id="shape-mold" class="shape shape--circle" data-shape="circle">
          <div id="shape-base" class="shape-base"></div>
          <div id="shape-fill" class="shape-fill" style="height:0%"></div>
        </div>
        <div id="dropzone" class="build-dropzone" aria-label="Plasare toppinguri"></div>
      </div>

      <!-- Pour tools -->
      <div id="tools-pour" class="tools--phase" data-phase="pour">
        <div class="row">
          <button id="btn-pour-hold" class="btn">🫗 Ține pentru turnare</button>
          <input id="pour-range" type="range" min="0" max="100" step="1" value="0" aria-label="Procent umplere">
          <b><span id="pour-pct">0</span>%</b>
        </div>
      </div>

      <!-- Decor tools -->
      <div id="tools-decor" class="tools--phase hidden" data-phase="decorate">
        <div class="row tight" style="margin-bottom:.25rem">
          <div><b>Plasate:</b> <span id="placed-count">0</span></div>
          <div class="small muted">Click pe un ingredient pentru a-l adăuga, apoi trage-l.</div>
        </div>
        <div id="palette" class="palette" aria-label="Paletă toppinguri"></div>
      </div>

      <!-- Common canvas controls -->
      <div class="canvas-controls">
        <div class="row">
          <label for="shape-select">Formă:</label>
          <select id="shape-select">
            <option value="circle">Cerc</option>
            <option value="heart">Inimă</option>
            <option value="star">Stea</option>
          </select>
          <span class="sep">•</span>
          Dimensiune:
          <input id="size-range" type="range" min="1" max="3" step="1" value="2" aria-label="Dimensiune aluat (S/M/L)">
          <span id="size-label" class="small muted">M</span>
        </div>
      </div>
    </section>

    <!-- Right: Bake & Serve -->
    <section class="game-panel" aria-labelledby="h-bake-serve">
      <h3 id="h-bake-serve">Bake & Serve</h3>

      <div class="bake-panel tools--phase hidden" data-phase="bake" aria-live="polite">
        <div class="oven">
          <img id="oven-img" src="images/oven_open.png" alt="Cuptor">
          <div class="progress-container" aria-label="Progres coacere">
            <div id="bake-bar" class="progress-bar"></div>
          </div>
          <div class="hit-window" title="Fereastra optimă de coacere">
            <span></span>
          </div>
          <div class="row tight small" style="margin-top:.25rem">
            Fereastră: <b id="bake-window-label">-</b>
          </div>
          <div class="row" style="margin-top:6px">
            <button id="btn-bake-start" class="btn">🔥 Pornește coacerea</button>
            <button id="btn-bake-stop" class="btn secondary" title="Oprește coacerea (Space)" disabled>🛑 Oprește</button>
          </div>
        </div>
      </div>

      <hr>

      <div class="serve-panel tools--phase hidden" data-phase="serve">
        <div class="panel soft">
          <div>Calitate totală: <b id="score-q-serve">0.00</b></div>
          <div>Cantitate: <b id="score-qty-serve">0</b> buc</div>
        </div>
        <button id="btn-serve" class="btn wide" disabled>✅ Servește clientul</button>
        <div class="small muted" style="margin-top:.25rem">
          După servire, începe automat o comandă nouă.
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="game-footer" role="contentinfo">
    <div class="left small muted">Apasă <b>Space</b> în etapa de coacere pentru a opri rapid.</div>
    <div class="right">
      <button id="btn-prev" class="btn secondary">⟵ Înapoi</button>
      <button id="btn-next" class="btn">Înainte ⟶</button>
    </div>
  </footer>

  <div class="toast-container" aria-live="polite"></div>

  <script>
  // =================== JS (no modules) ===================
  // Simple FK bridge -> calls PHP actions in this file
  const FK = {
    async state(){
      const r = await fetch('?action=state', {cache:'no-store'});
      return r.json();
    },
    async serve(qty, q, inWin){
      const fd = new FormData();
      fd.append('qty', String(qty));
      fd.append('q', String(q));
      fd.append('inWin', inWin ? '1' : '0');
      const r = await fetch('?action=serve', {method:'POST', body:fd});
      return r.json();
    },
    async reset(){
      const r = await fetch('?action=reset', {cache:'no-store'});
      return r.json();
    }
  };

  // ---------- Utils ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  // ---------- Ingredients ----------
  const ING = [
    { id:'chocolate_chips', name:'Cipuri ciocolată' },
    { id:'strawberries',    name:'Căpșuni' },
    { id:'coconut',         name:'Cocos' },
    { id:'sprinkles',       name:'Ornamente' },
    { id:'cacao',           name:'Cacao' },
    { id:'sugar',           name:'Zahăr' },
  ];
  // Harta ID → fișier PNG din /images (numele din lista ta de fișiere)
const TOP_IMG = {
  chocolate_chips: 'chocolate_chips.png',
  strawberries:    'strawberries.png',
  coconut:         'coconut.png',
  sprinkles:       'sprinkles.png',
  cacao:           'cacao.png',
  sugar:           'sugar.png',
};

  const PHASES = ['pour','decorate','bake','serve'];

  // ---------- Game state ----------
  const state = {
    phase:'pour',
    order:null,        // {size, shape, tops[], bake:[a,b], pour:[a,b]}
    sizeKey:'M',
    fillPct:0,
    placed:[],
    baking:{ running:false, dur: 2800+Math.floor(Math.random()*900), p:0, zone:[0.52,0.62], inWin:false, attempted:false, locked:false },
    scores:{ pour:0, top:0, bake:0, q:0, qty:0 },
  };
  let bakeTimer=null, pourTimer=null;

  // ---------- Audio ----------
  let audioOn = true;
  let __AC = null;
  function getAC(){ if(!audioOn) return null; try{ __AC = __AC || new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} return __AC; }
  function playDing(){ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(), g=ac.createGain(); o.type='triangle'; o.frequency.setValueAtTime(880,ac.currentTime); o.frequency.linearRampToValueAtTime(1320,ac.currentTime+0.12); g.gain.setValueAtTime(0.0001,ac.currentTime); g.gain.exponentialRampToValueAtTime(0.06,ac.currentTime+0.02); g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.2); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.22); }
  function playBuzz(){ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(), g=ac.createGain(); o.type='sawtooth'; o.frequency.value=220; g.gain.value=0.03; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{ try{o.stop();}catch(_){ } },120); }
  function playPlop(){ const ac=getAC(); if(!ac) return; const o=ac.createOscillator(), g=ac.createGain(); o.type='square'; o.frequency.value=560+Math.random()*160; g.gain.value=0.04; o.connect(g); g.connect(ac.destination); o.start(); setTimeout(()=>{ try{o.stop();}catch(_){ } },90); }

  // ---------- Feedback ----------
  function toast(msg){
    const host = document.querySelector('.toast-container');
    const d=document.createElement('div'); d.className='toast'; d.textContent=msg; host.appendChild(d);
    setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 1800);
  }
  function confettiAt(x,y,n=18){
    for(let i=0;i<n;i++){
      const d=document.createElement('div'); d.className='particle';
      const ang=Math.random()*Math.PI*2, dist=20+Math.random()*60;
      d.style.setProperty('--dx', Math.cos(ang)*dist+'px');
      d.style.setProperty('--dy', Math.sin(ang)*dist+'px');
      d.style.left=x+'px'; d.style.top=y+'px'; d.style.position='fixed';
      d.style.background=['#f3e38a','#f9a6a6','#a8d8f5','#c7f59e','#f7d57a'][i%5];
      d.style.animation='pop .7s ease-out forwards';
      document.body.appendChild(d); setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 800);
    }
  }
  function sprinkleAt(container, el){
    try{
      const rect=container.getBoundingClientRect();
      const r=el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const xPct=((cx-rect.left)/rect.width)*100, yPct=((cy-rect.top)/rect.height)*100;
      for(let i=0;i<6;i++){
        const d=document.createElement('div'); d.className='particle';
        d.style.setProperty('--dx', (Math.random()*40-20)+'px');
        d.style.setProperty('--dy', (Math.random()*40-20)+'px');
        d.style.left=xPct+'%'; d.style.top=yPct+'%';
        d.style.background=['#f8c66a','#f5a8a8','#a8d8f5','#c7f59e','#f9f09a'][i%5];
        d.style.animation='pop .5s ease-out forwards';
        container.appendChild(d); setTimeout(()=>{ try{ d.remove(); }catch(_){ } }, 600);
      }
    }catch(_){}
  }
  function ovenPuff(success){
    const img=$('#oven-img'); if(!img) return;
    const r=img.getBoundingClientRect();
    confettiAt(r.left+r.width*0.5, r.top+r.height*0.15, success?16:8);
  }

  // ---------- UI helpers ----------
  function setPhase(next){
    state.phase = next;

    // Stepper
    $$('#stepper li').forEach(li=>{
      const ph=li.getAttribute('data-phase');
      const idx=PHASES.indexOf(ph);
      const cur=PHASES.indexOf(next);
      li.classList.toggle('active', ph===next);
      li.classList.toggle('done', idx>-1 && idx<cur);
    });

    // Panels visibility
    $$('.tools--phase').forEach(sec=>{
      const ph=sec.getAttribute('data-phase');
      sec.classList.toggle('hidden', ph!==next);
    });

    // Buttons
    const canBakeStart = next==='bake' && !state.baking.locked && !state.baking.running;
    const canBakeStop  = next==='bake' && state.baking.running;
    const canServe     = next==='serve';

    $('#btn-bake-start')?.toggleAttribute('disabled', !canBakeStart);
    $('#btn-bake-stop') ?.toggleAttribute('disabled', !canBakeStop);
    $('#btn-serve')     ?.toggleAttribute('disabled', !canServe);
  }

  function updateMold(){
    const mold=$('#shape-mold'); if(!mold || !state.order) return;
    mold.className='shape shape--'+(state.order.shape||'circle');
    const px = state.sizeKey==='S'?160 : state.sizeKey==='L'?240 : 200;
    mold.style.setProperty('--mold-size', px+'px');

    const sel=$('#shape-select');
    if(sel && sel.value!==state.order.shape) sel.value=state.order.shape;
    $('#ord-shape') && ($('#ord-shape').textContent = (state.order.shape==='heart'?'Inimă':state.order.shape==='star'?'Stea':'Cerc'));
    $('#ord-size')  && ($('#ord-size').textContent  = state.sizeKey);
  }

  function updateFillUI(){
    const fill=$('#shape-fill'); if(!fill || !state.order) return;
    const pct=clamp(state.fillPct,0,1);
    fill.style.height=Math.round(pct*100)+'%';
    const [a,b]=state.order.pour;
    fill.classList.toggle('good', pct>=a && pct<=b);
    $('#pour-pct')  && ($('#pour-pct').textContent  = String(Math.round(pct*100)));
    $('#pour-range')&& ($('#pour-range').value = String(Math.round(pct*100)));
    calcPourScore(); renderScores();
  }

  function updateHitWindowUI(){
    if(!state.order) return;
    const [a,b]=state.order.bake;
    const span=document.querySelector('.hit-window span'); if(span){
      span.style.left=Math.round(a*100)+'%';
      span.style.width=Math.round((b-a)*100)+'%';
    }
    $('#bake-window-label') && ($('#bake-window-label').textContent = `${Math.round(a*100)}–${Math.round(b*100)}%`);
  }

 function buildPalette(){
  const wrap=$('#palette'); if(!wrap) return;
  wrap.innerHTML='';
  ING.forEach(ing=>{
    const b=document.createElement('button');
    b.type='button'; b.className='chip-btn';
    const imgSrc = 'images/' + (TOP_IMG[ing.id] || 'sprinkles.png');
    b.innerHTML = `<img src="${imgSrc}" alt="${ing.name}"><span>${ing.name}</span>`;
    b.addEventListener('click', ()=> spawnChip(ing.id));
    wrap.appendChild(b);
  });
}


function spawnChip(id){
  const zone=$('#dropzone'); if(!zone) return;

  const chip=document.createElement('div');
  chip.className='chip'; chip.dataset.type=id;
  chip.style.left=(25+Math.random()*50)+'%';
  chip.style.top =(25+Math.random()*50)+'%';

  // imaginea efectivă a toppingului
  const img=document.createElement('img');
  img.src = 'images/' + (TOP_IMG[id] || 'sprinkles.png');
  img.alt = (ING.find(i=>i.id===id)?.name) || id;
  chip.appendChild(img);

  // drag & drop pe containerul .chip
  let dragging=false, pid=0, sx=0, sy=0, ox=0, oy=0;
  const start=(e)=>{ dragging=true; pid=e.pointerId||0; chip.setPointerCapture && chip.setPointerCapture(pid);
    sx=e.clientX; sy=e.clientY; const r=chip.getBoundingClientRect(); ox=r.left; oy=r.top; chip.style.cursor='grabbing'; };
  const move =(e)=>{ if(!dragging) return;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    const parent=zone.getBoundingClientRect();
    const nx=((ox+dx)-parent.left)/parent.width*100;
    const ny=((oy+dy)-parent.top)/parent.height*100;
    chip.style.left=clamp(nx,5,95)+'%';
    chip.style.top =clamp(ny,5,95)+'%';
  };
  const end  =()=>{ dragging=false; chip.style.cursor='move';
    try{ chip.releasePointerCapture && chip.releasePointerCapture(pid); }catch(_){}
    sprinkleAt(zone, chip); playPlop(); savePlaced();
  };

  chip.addEventListener('pointerdown', start, {passive:true});
  chip.addEventListener('pointermove',  move);
  chip.addEventListener('pointerup',    end,  {passive:true});

  zone.appendChild(chip);
  savePlaced();
}


  function readPlacedFromDOM(){
    return $$('#dropzone .chip').map(el=>({
      id: el.dataset.type || 'unknown',
      x: parseFloat(el.style.left) || 0,
      y: parseFloat(el.style.top)  || 0,
    }));
  }
  function savePlaced(){
    state.placed = readPlacedFromDOM();
    $('#placed-count') && ($('#placed-count').textContent = String(state.placed.length));
    calcTopScore(); renderScores();
  }

  // ---------- Scoring ----------
  function calcTopScore(){
    if(!state.order){ state.scores.top=0; return; }
    const want=new Set(state.order.tops);
    const have=new Set(state.placed.map(p=>p.id));
    let pts=0;
    want.forEach(id=>{ if(have.has(id)) pts+=25; });
    pts=Math.min(100, pts);

    if(state.placed.length>1){
      const mx=state.placed.reduce((s,p)=>s+p.x,0)/state.placed.length;
      const my=state.placed.reduce((s,p)=>s+p.y,0)/state.placed.length;
      let spread=0; state.placed.forEach(p=>{ const dx=p.x-mx, dy=p.y-my; spread+=Math.sqrt(dx*dx+dy*dy); });
      const spreadScore = clamp(spread/(state.placed.length*20),0,1)*20;
      pts = clamp(pts + spreadScore, 0, 100);
    }
    state.scores.top = Math.round(pts);
  }
  function calcPourScore(){
    if(!state.order){ state.scores.pour=0; return; }
    const pct=clamp(state.fillPct,0,1);
    const [a,b]=state.order.pour;
    const c=(a+b)/2, half=(b-a)/2, d=Math.abs(pct-c);
    let score;
    if(d<=half) score = 70 + (1 - d/half)*30;
    else { const far=Math.min(1,(d-half)/0.25); score=Math.max(0, 70 - far*60); }
    state.scores.pour = Math.round(clamp(score,0,100));
  }
  function computeFinalScores(){
    const wPour=0.30, wTop=0.40, wBake=0.30;
    const p=clamp(state.scores.pour/100,0,1);
    const t=clamp(state.scores.top /100,0,1);
    const b=clamp(state.scores.bake/100,0,1);
    const q=clamp(0.82 + (p*0.06*wPour + t*0.10*wTop + b*0.08*wBake), 0.82, 0.98);
    const base={S:8,M:10,L:12}[state.sizeKey]||10;
    const qty=clamp(base + Math.round(state.fillPct*3) + Math.floor(state.placed.length/3), 6, 18);
    state.scores.q = Number(q.toFixed(2));
    state.scores.qty = qty;
  }
  function renderScores(){
    $('#score-pour') && ($('#score-pour').textContent = String(state.scores.pour));
    $('#score-top')  && ($('#score-top').textContent  = String(state.scores.top));
    $('#score-bake') && ($('#score-bake').textContent = String(state.scores.bake));
    $('#score-q')    && ($('#score-q').textContent    = (state.scores.q||0).toFixed(2));
    $('#score-qty')  && ($('#score-qty').textContent  = String(state.scores.qty||0));
    $('#score-q-serve')   && ($('#score-q-serve').textContent   = (state.scores.q||0).toFixed(2));
    $('#score-qty-serve') && ($('#score-qty-serve').textContent = String(state.scores.qty||0));
  }

  // ---------- Bake ----------
  function startBake(){
    if(state.phase!=='bake') return;
    if(state.baking.locked || state.baking.running) return;
    state.baking.running=true; state.baking.p=0;
    $('#btn-bake-start')?.setAttribute('disabled','true');
    $('#btn-bake-stop') ?.removeAttribute('disabled');
    $('#oven-img')?.setAttribute('src','images/oven_closed.png');
    const bar=$('#bake-bar'); clearInterval(bakeTimer);
    const dur=state.baking.dur, step=90;
    bakeTimer=setInterval(()=>{
      state.baking.p = clamp(state.baking.p + step/dur, 0, 1);
      if(bar) bar.style.width=(state.baking.p*100)+'%';
      if(state.baking.p>=1) stopBake();
    }, step);
    setPhase('bake');
  }
  function stopBake(){
    if(!state.baking.running) return;
    state.baking.running=false;
    clearInterval(bakeTimer); bakeTimer=null;
    $('#btn-bake-stop')?.setAttribute('disabled','true');
    $('#oven-img')?.setAttribute('src','images/oven_open.png');

    const p=state.baking.p, [a,b]=state.baking.zone;
    const c=(a+b)/2, maxD=Math.max(0.0001,(b-a)/2), d=Math.abs(p-c);
    const inWin = p>=a && p<=b;
    state.baking.inWin=inWin; state.baking.attempted=true; state.baking.locked=true;

    state.scores.bake = Math.round(clamp(100*(1-Math.min(1,d/maxD)), 0, 100));

    if(inWin){ playDing(); ovenPuff(true); }
    else     { playBuzz(); $('#oven-img')?.classList.add('shake'); setTimeout(()=>$('#oven-img')?.classList.remove('shake'),380); ovenPuff(false); }

    computeFinalScores(); renderScores();
    setPhase('serve');
  }

  // ---------- Serve ----------
  async function serveClient(){
    if(state.phase!=='serve'){ toast('Finalizează coacerea înainte de servire.'); return; }
    computeFinalScores();
    const q=state.scores.q||0.86, qty=state.scores.qty||8;
    const inWin = !!state.baking.inWin;

    try{
      const res = await FK.serve(qty, q, inWin);
      if(res && res.ok){
        // confetti on button
        const btn=$('#btn-serve');
        if(btn){ const r=btn.getBoundingClientRect(); confettiAt(r.left+r.width/2, r.top+r.height/2, 24); }
        toast(`✅ Servit! +${qty} stoc · Q ${q.toFixed(2)}`);
        await refreshTopbar();
        // new order
        newOrder();
        setPhase('pour');
      } else {
        toast('Eroare la servire.');
      }
    }catch(e){
      console.error(e); toast('Eroare de rețea la servire.');
    }
  }

  // ---------- Order / topbar ----------
  function renderOrder(){
    if(!state.order) return;
    $('#ord-shape') && ($('#ord-shape').textContent = (state.order.shape==='heart'?'Inimă':state.order.shape==='star'?'Stea':'Cerc'));
    $('#ord-size')  && ($('#ord-size').textContent  = state.order.size);
    $('#ord-bake')  && ($('#ord-bake').textContent  = `${Math.round(state.order.bake[0]*100)}–${Math.round(state.order.bake[1]*100)}%`);
    const ul=$('#ord-tops');
    if(ul){
      ul.innerHTML='';
      state.order.tops.forEach(id=>{
        const li=document.createElement('li');
        const name = (ING.find(i=>i.id===id)?.name)||id;
        li.textContent = name;
        ul.appendChild(li);
      });
    }
  }
  async function refreshTopbar(){
    try{
      const s = await FK.state();
      if(s && s.ok){
        $('#g-stock') && ($('#g-stock').textContent = String(s.stock?.units ?? 0));
        const pct = Math.round(s.boost?.percent || 0);
        const cnt = (s.boost?.buffs?.length) || 0;
        $('#g-boost') && ($('#g-boost').textContent = pct + '%' + (cnt>0?` (${cnt})`:''));
      }
    }catch(_){}
  }

  function newOrder(){
    const map={1:'S',2:'M',3:'L'};
    const slider=$('#size-range');
    state.sizeKey = map[ Number(slider?.value||2) ] || 'M';

    const shapes=['circle','heart','star'];
    const shape=shapes[Math.floor(Math.random()*shapes.length)];

    const tops = ING.slice().sort(()=>Math.random()-0.5).slice(0, 2+Math.floor(Math.random()*3)).map(t=>t.id);

    const bakeCenter = 0.54 + (Math.random()*0.06 - 0.03);
    const bakeWidth  = 0.08 + Math.random()*0.04;
    const pourCenter = 0.80 + (Math.random()*0.06 - 0.03);
    const pourWidth  = 0.12;

    state.order = {
      size: state.sizeKey,
      shape,
      tops,
      bake: [clamp(bakeCenter-bakeWidth/2, 0.15, 0.85), clamp(bakeCenter+bakeWidth/2, 0.20, 0.95)],
      pour: [clamp(pourCenter-pourWidth/2, 0.55, 0.95), clamp(pourCenter+pourWidth/2, 0.60, 0.98)],
    };

    state.phase='pour';
    state.fillPct=0;
    state.placed=[];
    state.baking={ running:false, dur:2800+Math.floor(Math.random()*900), p:0, zone:[...state.order.bake], inWin:false, attempted:false, locked:false };
    state.scores={ pour:0, top:0, bake:0, q:0, qty:0 };

    const sel=$('#shape-select'); if(sel) sel.value=shape;
    updateMold();
    updateFillUI();
    renderOrder();
    // Clear dropzone contents (precompiled exists)
    const zone=$('#dropzone'); if(zone) zone.innerHTML='';
    $('#placed-count') && ($('#placed-count').textContent = '0');
    updateHitWindowUI();
    renderScores();
  }

  // ---------- Events ----------
  function wireEvents(){
    $('#btn-prev')?.addEventListener('click', ()=>{
      const idx=Math.max(0, PHASES.indexOf(state.phase)-1);
      if(state.phase==='bake' && state.baking.running){ toast('Oprește coacerea mai întâi.'); return; }
      setPhase(PHASES[idx]);
    });
    $('#btn-next')?.addEventListener('click', ()=>{
      const idx=Math.min(PHASES.length-1, PHASES.indexOf(state.phase)+1);
      if(state.phase==='pour'){ if(!state.order) return; if(state.fillPct < state.order.pour[0]){ toast('Toarnă puțin mai mult!'); return; } }
      if(state.phase==='decorate'){ if(state.placed.length<2){ toast('Adaugă cel puțin două toppinguri.'); return; } }
      if(state.phase==='bake'){ if(!state.baking.attempted){ toast('Pornește coacerea înainte de a continua.'); return; } }
      setPhase(PHASES[idx]);
    });

    $('#btn-new-order')?.addEventListener('click', ()=>{ newOrder(); setPhase('pour'); });

    // Pour
    $('#btn-pour-hold')?.addEventListener('pointerdown', (e)=>{ e.preventDefault(); clearInterval(pourTimer); pourTimer=setInterval(()=>{ state.fillPct=clamp(state.fillPct+0.01,0,1); updateFillUI(); }, 70); });
    ['pointerup','pointerleave','pointercancel'].forEach(ev => $('#btn-pour-hold')?.addEventListener(ev, ()=>{ clearInterval(pourTimer); pourTimer=null; }));
    $('#pour-range')?.addEventListener('input', (e)=>{ const v=Number(e.target.value||0); state.fillPct=clamp(v/100,0,1); updateFillUI(); });

    // Decor
    buildPalette();

    // Size + shape
    $('#size-range')?.addEventListener('input', (e)=>{ const map={1:'S',2:'M',3:'L'}; state.sizeKey = map[ Number(e.target.value||2) ] || 'M'; $('#size-label') && ($('#size-label').textContent = state.sizeKey); updateMold(); computeFinalScores(); renderScores(); });
    $('#shape-select')?.addEventListener('change', (e)=>{ if(!state.order) return; state.order.shape = e.target.value||'circle'; updateMold(); });

    // Bake controls
    $('#btn-bake-start')?.addEventListener('click', startBake);
    $('#btn-bake-stop') ?.addEventListener('click', stopBake);
    document.addEventListener('keydown', (e)=>{ if(e.code==='Space' && state.phase==='bake'){ e.preventDefault(); if(state.baking.running) stopBake(); } });

    // Serve
    $('#btn-serve')?.addEventListener('click', serveClient);

    // Audio toggle
    $('#btn-audio')?.addEventListener('click', (e)=>{ audioOn=!audioOn; e.currentTarget.setAttribute('aria-pressed', audioOn?'true':'false'); e.currentTarget.textContent = audioOn?'🔊 Sunet':'🔈 Mut'; toast(audioOn?'🔊 Sunet ON':'🔈 Sunet OFF'); });

    // Reset
    $('#btn-reset')?.addEventListener('click', async ()=>{
      try{ await FK.reset(); await refreshTopbar(); toast('Sesiune resetată.'); }catch(_){}
    });
  }

  // ---------- Init ----------
  async function mount(){
    wireEvents();
    // initial size label
    const map={1:'S',2:'M',3:'L'}; const slider=$('#size-range'); if($('#size-label')&&slider){ $('#size-label').textContent = map[ Number(slider.value||2) ] || 'M'; }
    newOrder();
    updateHitWindowUI();
    setPhase('pour');
    await refreshTopbar();
    setInterval(refreshTopbar, 4000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  </script>
</body>
</html>
