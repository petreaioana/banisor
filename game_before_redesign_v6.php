<?php
/**
 * FinKids Tycoon — VIEW (root)
 * Rol: randare HTML + legături către CSS/JS din game_assets.
 * API-ul JSON este în game_assets/api.php.
 * Dependențe:
 *  - CSS:  game_assets/css/game.css
 *  - JS:   game_assets/js/game.js
 *  - IMG:  game_assets/images/*
 */
?><!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FinKids Tycoon — Joc manual</title>
  <meta name="color-scheme" content="light only" />
  <link rel="stylesheet" href="game_assets/css/game.css?v=5" />
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
    <div class="right">
      <button id="btn-prev" class="btn secondary">⟵ Înapoi</button>
      <button id="btn-next" class="btn">Înainte ⟶</button>
    </div>
  </header>

  <!-- Stepper -->
  <nav id="stepper" aria-label="Etape joc">
    <ol>
      <li data-phase="pour"     class="active">🍯 Turnare</li>
      <li data-phase="decorate">🍬 Decor</li>
      <li data-phase="bake">🔥 Coacere</li>
      <li data-phase="serve">🧁 Servire</li>
    </ol>
  </nav>

  <!-- Content -->
  <main id="game-layout" class="game-layout" role="main" data-phase="pour">
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
        <b>Trucul lui Bănișor:</b>
        <div style="margin-top:.25rem">Umple zona verde, adaugă toppingurile cerute și oprește cuptorul la timp.</div>
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
          <button id="btn-pour-hold" class="btn">🍯 Ține pentru turnare</button>
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
    <section id="bake-serve-panel" class="game-panel hidden" aria-labelledby="h-bake-serve">
      <h3 id="h-bake-serve">Bake & Serve</h3>

      <div class="bake-panel tools--phase hidden" data-phase="bake" aria-live="polite">
        <div class="oven">
          <img id="oven-img" src="game_assets/images/oven_open.png" alt="Cuptor">
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
  </footer>

  <div class="toast-container" aria-live="polite"></div>

  <script src="game_assets/js/game.js"></script>
</body>
</html>
