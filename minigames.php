<?php
declare(strict_types=1);
session_start();

if (empty($_SESSION['minigames_csrf'])) {
    $_SESSION['minigames_csrf'] = bin2hex(random_bytes(32));
}
$csrf = $_SESSION['minigames_csrf'];
$cssVersion = (int)filemtime(__DIR__ . '/game_assets/css/minigames.css');
$jsVersion = (int)filemtime(__DIR__ . '/game_assets/js/minigames.js');
?>
<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f2e5">
  <title>Provocările lui Bănișor</title>
  <link rel="stylesheet" href="game_assets/css/minigames.css?v=<?= $cssVersion ?>">
</head>
<body>
  <div class="game-shell">
    <header class="game-topbar">
      <a class="brand" href="index.php" aria-label="Înapoi la magazin">
        <span class="brand-mark" aria-hidden="true">B</span>
        <span><strong>Bănișor</strong><small>clubul de provocări</small></span>
      </a>
      <nav class="top-actions" aria-label="Navigare">
        <a href="index.php">Magazin</a>
        <a href="game.php">Atelier</a>
      </nav>
      <div class="collection-pill" aria-live="polite">
        <span aria-hidden="true">✦</span>
        <span><b id="total-stars">0</b> stele</span>
      </div>
    </header>

    <main id="main-content">
      <section id="hub-view" class="hub-view" aria-labelledby="hub-title">
        <div class="hero-panel">
          <div class="hero-copy">
            <p class="eyebrow">MISIUNI SCURTE, IDEI MARI</p>
            <h1 id="hub-title">Învață jucându-te cu banii.</h1>
            <p class="hero-description">Alege o provocare, încearcă, descoperă răspunsul. Banii din magazin rămân în siguranță.</p>
            <div class="hero-stats">
              <span class="stat-dot" aria-hidden="true">●</span>
              <span><b id="done-count">0</b> provocări încheiate</span>
            </div>
          </div>
          <div class="hero-illustration" aria-hidden="true">
            <div class="sun-disc"></div>
            <div class="coin-stack"><i>50</i><i>10</i><i>5</i></div>
            <div class="jar-art"><span>✦</span><span>✦</span><span>✦</span></div>
            <span class="orbit orbit-one">+</span>
            <span class="orbit orbit-two">1</span>
          </div>
        </div>

        <div class="section-heading">
          <div>
            <p class="eyebrow">HARTA MISIUNILOR</p>
            <h2>Alege ce vrei să exersezi</h2>
          </div>
          <p class="quiet-note">Poți reveni la orice joc.</p>
        </div>
        <div id="mission-grid" class="mission-grid" aria-live="polite"></div>
        <p id="save-status" class="save-status" role="status">Progresul se salvează automat.</p>
      </section>

      <section id="play-view" class="play-view" hidden aria-labelledby="play-title">
        <div class="play-heading">
          <button id="back-to-hub" class="back-button" type="button"><span aria-hidden="true">←</span> Toate provocările</button>
          <div class="play-title-block">
            <span id="play-icon" class="play-icon" aria-hidden="true">✦</span>
            <div><p id="play-category" class="eyebrow"></p><h1 id="play-title"></h1></div>
          </div>
        </div>

        <div class="play-layout">
          <section class="stage-card" aria-label="Zona de joc">
            <div id="game-stage" class="game-stage"></div>
          </section>
          <aside class="coach-card" aria-labelledby="coach-title">
            <div class="coach-mascot" aria-hidden="true"><span></span><i></i><b></b></div>
            <p class="eyebrow">UN PONT DE LA BĂNIȘOR</p>
            <h2 id="coach-title">Încearcă pe rând.</h2>
            <p id="coach-copy">Nu trebuie să te grăbești. Fiecare încercare te ajută să înțelegi mai bine.</p>
            <div class="mini-progress"><span id="game-progress-bar"></span></div>
            <p id="game-progress-label" class="progress-label">Misiune nouă</p>
          </aside>
        </div>
      </section>
    </main>

    <footer class="game-footer">
      <span>Provocările adună stele și idei. Nu schimbă soldul magazinului.</span>
      <a href="index.php">Înapoi la magazin</a>
    </footer>
  </div>

  <script>window.MINIGAMES_CONFIG = <?= json_encode(['csrf' => $csrf], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;</script>
  <script src="game_assets/js/minigames.js?v=<?= $jsVersion ?>" defer></script>
</body>
</html>
