<?php
declare(strict_types=1);
session_start();

// API: salvează progresul în sesiune + cookie (1 an)
if (isset($_GET['action']) && $_GET['action'] === 'save') {
    header('Content-Type: application/json; charset=utf-8');
    $raw = file_get_contents('php://input');
    $ok = false;
    if ($raw !== false && strlen($raw) < 3800) {
        $data = json_decode($raw, true);
        if (is_array($data)) {
            $_SESSION['cookie_profile'] = $data;
            @setcookie(
                'cookie_profile',
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                time() + 31536000,
                '/', '', false, true
            );
            $ok = true;
        }
    }
    echo json_encode(['ok' => $ok]);
    exit;
}

// Stare inițială din sesiune/cookie (fallback implicit)
$serverState = [
    'lei' => 0,
    'progress' => ['cookies' => ['day' => 1, 'profitBest' => 0]],
    'meta' => ['introSeen' => false],
];
if (!empty($_SESSION['cookie_profile']) && is_array($_SESSION['cookie_profile'])) {
    $serverState = array_replace_recursive($serverState, $_SESSION['cookie_profile']);
} elseif (!empty($_COOKIE['cookie_profile'])) {
    $cookie = json_decode((string)$_COOKIE['cookie_profile'], true);
    if (is_array($cookie)) {
        $serverState = array_replace_recursive($serverState, $cookie);
    }
}
?>
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Simulator Biscuiți FinKids</title>
  <link rel="preload" as="image" href="shop_background.png" />
  <link rel="preload" as="image" href="kitchen_background.png" />
  <link rel="preload" as="image" href="worktop_background.png" />
  <link rel="stylesheet" href="game.css" />
  <script>
    // Seed state din server (sesiune/cookie)
    window.__SERVER_STATE__ = <?php echo json_encode($serverState, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);?>;
  </script>
  <script src="game.js" defer></script>
  <noscript><style>main{display:none}</style></noscript>
</head>
<body>
  <div id="top-bar">
    <span id="day-display">Ziua: <span id="day-num">1</span></span>
    <span class="lei-display" style="margin-left:auto">Lei: <span id="lei-count">0</span></span>
  </div>
  <main id="cookie-game"></main>
  <noscript>
    Este nevoie de JavaScript pentru a rula jocul.
  </noscript>
</body>
</html>
