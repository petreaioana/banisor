<!-- game.php -->
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FinKids Tycoon — Joc manual</title>

  <!-- Stiluri -->
  <link rel="stylesheet" href="assets/styles/base.css" />
  <link rel="stylesheet" href="assets/styles/game.css" />

  <!-- Preload imagini pentru cuptor -->
  <link rel="preload" as="image" href="images/oven_open.png" />
  <link rel="preload" as="image" href="images/oven_closed.png" />

  <!-- Logica jocului manual -->
  <script type="module" src="assets/js/game/game.js" defer></script>
</head>
<body>
  <!-- Topbar -->
  <header id="topbar" role="banner" aria-label="Bară de navigare joc">
    <div class="left">
      <a class="brand" href="/">🍪 FinKids Tycoon</a>
      <span class="sep">•</span>
      <a class="btn" href="index.php" aria-label="Înapoi la Manager">⬅️ Înapoi la Manager</a>
      <span class="sep">•</span>
      <button id="btn-audio" class="btn secondary" aria-pressed="true" title="Sunet ON/OFF">🔊 Sunet</button>
    </div>
    <div class="right" aria-live="polite">
      📦 Stoc: <b id="g-stock">0</b>
      <span class="sep">•</span>
      ⚡ Boost: <b id="g-boost">0%</b>
    </div>
  </header>

  <!-- Stepper (etape) -->
  <nav id="stepper" aria-label="Etape joc">
    <ol>
      <li data-phase="pour" class="active">🫙 Turnare</li>
      <li data-phase="decorate">🍬 Decor</li>
      <li data-phase="bake">🔥 Coacere</li>
      <li data-phase="serve">🧁 Servire</li>
    </ol>
  </nav>

  <!-- Conținut joc -->
  <main class="game-layout" role="main">
    <!-- Stânga: Comandă -->
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

      <!-- Tips prietenoase -->
      <div class="panel soft small">
        <b>Tips de la Bănișor:</b>
        <ul style="margin:.25rem 0 .25rem 1.2rem">
          <li>Umple forma până la dungulița verde.</li>
          <li>Pune toppingurile cerute, răspândite frumos.</li>
          <li>Oprește cuptorul în fereastra verde pentru bonus ✨.</li>
        </ul>
      </div>

      <hr>

      <!-- Scoruri rapide -->
      <div class="panel soft small">
        <div>Scor turnare: <b id="score-pour">0</b>/100</div>
        <div>Scor decor: <b id="score-top">0</b>/100</div>
        <div>Scor coacere: <b id="score-bake">0</b>/100</div>
        <div>Calitate Q: <b id="score-q">0.00</b></div>
        <div>Cantitate: <b id="score-qty">0</b> buc</div>
      </div>
    </section>

    <!-- Centru: Canvas + unelte -->
    <section class="game-panel" aria-labelledby="h-canvas">
      <h3 id="h-canvas">Stație de lucru</h3>

      <!-- Canvas (JS creează forma + dropzone dacă lipsesc) -->
      <div class="build-stage" aria-live="polite" aria-label="Zonă de lucru prăjitură"></div>

      <!-- Unelte Turnare -->
      <div id="tools-pour" class="tools--phase" data-phase="pour">
        <div class="row">
          <button id="btn-pour-hold" class="btn">🫗 Ține pentru turnare</button>
          <input id="pour-range" type="range" min="0" max="100" step="1" value="0" aria-label="Procent umplere">
          <b><span id="pour-pct">0</span>%</b>
        </div>
      </div>

      <!-- Unelte Decor -->
      <div id="tools-decor" class="tools--phase hidden" data-phase="decorate">
        <div class="row tight" style="margin-bottom:.25rem">
          <div><b>Plasate:</b> <span id="placed-count">0</span></div>
          <div class="small muted">Click pe un ingredient pentru a-l adăuga, apoi trage-l.</div>
        </div>
        <div id="palette" class="palette" aria-label="Paletă toppinguri"></div>
      </div>

      <!-- Controale comune Canvas -->
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

    <!-- Dreapta: Bake & Serve -->
    <section class="game-panel" aria-labelledby="h-bake-serve">
      <h3 id="h-bake-serve">Bake & Serve</h3>

      <!-- Bake -->
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

      <!-- Serve -->
      <div class="serve-panel tools--phase hidden" data-phase="serve">
        <div class="panel soft">
          <div>Calitate totală: <b id="score-q-serve">0.00</b></div>
          <div>Cantitate: <b id="score-qty-serve">0</b> buc</div>
        </div>
        <button id="btn-serve" class="btn wide" title="Consumă ingrediente conform rețetei și adaugă în stoc" disabled>✅ Servește clientul</button>
        <div class="small muted" style="margin-top:.25rem">
          După servire, începe automat o comandă nouă.
        </div>
      </div>
    </section>
  </main>

  <!-- Footer navigare etape -->
  <footer class="game-footer" role="contentinfo">
    <div class="left small muted">Apasă <b>Space</b> în etapa de coacere pentru a opri rapid.</div>
    <div class="right">
      <button id="btn-prev" class="btn secondary">⟵ Înapoi</button>
      <button id="btn-next" class="btn">Înainte ⟶</button>
    </div>
  </footer>

  <noscript>E nevoie de JavaScript pentru joc.</noscript>
</body>
</html>
