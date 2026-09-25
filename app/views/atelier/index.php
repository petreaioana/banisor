<?php
// app/views/atelier/index.php
?>
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bănișor Atelier</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="<?= asset_url('css/atelier.css') ?>?v=<?= (int)filemtime(__DIR__.'/../../../assets/css/atelier.css') ?>">
  <link rel="stylesheet" href="<?= asset_url('css/atelier-overrides.css') ?>?v=<?= (int)filemtime(__DIR__.'/../../../assets/css/atelier-overrides.css') ?>">
</head>
<body class="bg-cream">
  <nav class="navbar navbar-light bg-lemon sticky-top border-bottom">
    <div class="container">
      <a class="navbar-brand d-flex align-items-center gap-2" href="?r=dashboard.index">
        <span class="banisor-sprite" aria-hidden="true"></span>
        <strong>Bănișor Atelier</strong>
      </a>
      <div class="ms-auto d-flex align-items-center gap-3">
        <span class="small">📦 Stoc: <b><?= (int)$stock ?></b></span>
        <span class="small">⚡ Boost: <b><?= (int)$boostPct ?>%</b></span>
        <form method="post" action="?r=atelier.reset" onsubmit="return confirm('Golești producția pregătită pentru manager?')">
          <?php view('partials/form_csrf.php'); ?>
          <button class="btn btn-outline-secondary btn-sm" type="submit">Golește transferul</button>
        </form>
        <a class="btn btn-outline-dark btn-sm" href="minigames.php">🧩 Provocări</a>
        <a class="btn btn-warning btn-sm" href="?r=dashboard.index">⬅️ Înapoi la Manager</a>
      </div>
    </div>
  </nav>

  <div class="container py-3">
    <?php if (isset($_GET['ok']) && $_GET['ok']==='served'): ?>
      <div class="alert alert-success shadow-sm">
        ✅ Servit! +<?= (int)($_GET['add']??0) ?> buc · Q <?= htmlspecialchars($_GET['q']??'0.00') ?>
        <div class="small text-muted">Se importă automat în manager la următoarea rulare.</div>
      </div>
    <?php elseif(isset($_GET['ok']) && $_GET['ok']==='reset'): ?>
      <div class="alert alert-secondary">Atelier golit.</div>
    <?php elseif(isset($_GET['err']) && $_GET['err']==='qty'): ?>
      <div class="alert alert-danger">Cantitatea trebuie să fie cel puțin 1.</div>
    <?php endif; ?>

    <!-- Stepper -->
    <ol class="stepper shadow-sm">
      <li class="active" data-step="pour">🍯 Turnare</li>
      <li data-step="decor">🍬 Decor</li>
      <li data-step="bake">🔥 Coacere</li>
      <li data-step="serve">🧁 Servire</li>
    </ol>

    <div class="row g-3">
      <!-- Stânga: comandă + scor -->
      <div class="col-12 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">Comanda Zilei</h5>
            <ul class="list-unstyled mb-2" id="order-info" aria-live="polite">
              <li><b>Formă:</b> <span id="ord-shape">Cerc</span></li>
              <li><b>Mărime:</b> <span id="ord-size">M</span></li>
              <li><b>Toppinguri:</b> <span id="ord-tops">Căpșuni + Ornamente</span></li>
              <li><b>Țintă coacere:</b> <span id="ord-bake">se calculează</span></li>
            </ul>
            <hr>
            <div class="small text-muted">Tip de la <b>Bănișor</b>: Oprește în zona verde pentru bonus ✨</div>
            <div class="banisor-helper mt-3">
              <div class="banisor-face"></div>
              <div class="speech">Bravo! Ține apăsat pentru turnare, apoi adaugă două toppinguri, apoi coace!</div>
            </div>
            <hr>
            <div class="row gy-1 small">
              <div class="col-6">Turnare: <b id="score-pour">0</b>/100</div>
              <div class="col-6">Decor: <b id="score-top">0</b>/100</div>
              <div class="col-6">Coacere: <b id="score-bake">0</b>/100</div>
              <div class="col-6">Q: <b id="score-q">0.00</b></div>
              <div class="col-6">Cant: <b id="score-qty">0</b> buc</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mijloc: canvaș -->
      <div class="col-12 col-lg-5">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title d-flex justify-content-between align-items-center">
              <span id="station-title">Stație de lucru</span>
              <span class="badge text-bg-warning small" id="step-badge">Turnare</span>
            </h5>
            <div class="build-stage mb-2" role="group" aria-label="Zonă de lucru">
              <div id="shape-mold" class="shape">
                <div id="shape-base" class="shape-base"></div>
                <div id="shape-fill" class="shape-fill"></div>
              </div>
              <div id="dropzone" class="dropzone"></div>
            </div>

            <!-- Panouri per etapă (fără JS greu) -->
            <div id="panel-pour" class="panel-phase">
              <div class="d-flex align-items-center gap-2">
                <button id="btn-pour" class="btn btn-primary" aria-label="Ține apăsat pentru a turna aluat">🍯 Ține pentru turnare</button>
                <input id="pour-range" type="range" min="0" max="100" step="1" value="0" class="form-range w-100" aria-label="Procent umplere">
                <b><span id="pour-pct">0</span>%</b>
              </div>
              <div id="pour-feedback" class="stage-feedback" aria-live="polite">Începe turnarea până la zona cerută.</div>
            </div>

            <div id="panel-decor" class="panel-phase d-none">
              <div class="small text-muted mb-1">Adaugă toate ingredientele cerute. Le poți trage în formă sau muta cu săgețile.</div>
              <div class="palette" id="palette"></div>
              <div id="decor-feedback" class="stage-feedback" aria-live="polite">Alege ingredientele din comandă și așază-le în formă.</div>
            </div>

            <div id="panel-bake" class="panel-phase d-none">
              <div class="mb-1 small">Fereastră: <b id="bake-window">-</b></div>
              <div class="progress bg-light border rounded" style="height:20px">
                <div id="bake-bar" class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="width: 0%"></div>
              </div>
              <div class="hit-window mt-2"><span></span></div>
              <div class="d-flex gap-2 mt-2">
                <button id="btn-bake-start" class="btn btn-danger">🔥 Pornește</button>
                <button id="btn-bake-stop" class="btn btn-outline-dark" disabled>🛑 Oprește</button>
              </div>
              <div class="form-text">Poți apăsa și <b>Space</b> pentru a opri.</div>
              <div id="bake-feedback" class="stage-feedback" aria-live="polite">Pornește cuptorul și oprește-l în fereastra verde.</div>
            </div>

            <div id="panel-serve" class="panel-phase d-none">
              <form method="post" action="?r=atelier.serve" class="d-grid gap-2" id="serve-form">
                <?php view('partials/form_csrf.php'); ?>
                <input type="hidden" name="qty"  id="f-qty" value="0">
                <input type="hidden" name="q"    id="f-q"   value="0.86">
                <input type="hidden" name="inwin" id="f-inwin" value="0">
                <div class="alert alert-warning small">
                  <div>Calitate totală: <b id="serve-q">0.00</b></div>
                  <div>Cantitate: <b id="serve-qty">0</b> buc</div>
                </div>
                <button class="btn btn-success btn-lg">✅ Servește</button>
              </form>
            </div>

            <div class="d-flex justify-content-between mt-3">
              <button class="btn btn-outline-secondary" id="btn-prev">⟵ Înapoi</button>
              <button class="btn btn-warning" id="btn-next">Înainte ⟶</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Dreapta: setări rapide -->
      <div class="col-12 col-lg-3">
        <div class="card h-100">
          <div class="card-body">
            <h5 class="card-title">Setări rapide</h5>
            <div class="mb-2">
              <label class="form-label">Formă</label>
              <select id="shape-select" class="form-select form-select-sm">
                <option value="circle">Cerc</option>
                <option value="heart">Inimă</option>
                <option value="star">Stea</option>
              </select>
            </div>
            <div>
              <label class="form-label">Mărime</label>
              <input id="size-range" type="range" min="1" max="3" step="1" value="2" class="form-range">
              <div class="small text-muted">Curent: <b id="size-label">M</b></div>
            </div>
            <hr>
            <div class="small text-muted">După „Servește”, producția intră în <b>transfer</b> și e importată automat de <b>Manager</b>.</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- JS minim -->
  <script src="<?= asset_url('js/atelier.js') ?>?v=<?= md5_file(__DIR__.'/../../../assets/js/atelier.js') ?>"></script>
</body>
</html>
