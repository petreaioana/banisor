<?php
declare(strict_types=1);
session_start();
require __DIR__ . '/lib/jsonfs.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

function minigames_reply(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function minigames_progress(): array
{
    $progress = jsonfs_read('minigames/progress.json', ['version' => 1, 'games' => []]);
    if (!is_array($progress)) $progress = ['version' => 1, 'games' => []];
    if (!isset($progress['games']) || !is_array($progress['games'])) $progress['games'] = [];
    return $progress;
}

$action = $_GET['action'] ?? 'state';
if ($action === 'state' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    minigames_reply(['ok' => true, 'progress' => minigames_progress()]);
}

if ($action !== 'complete' || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: GET, POST');
    minigames_reply(['ok' => false, 'error' => 'unknown_action'], 405);
}

$body = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($body)) minigames_reply(['ok' => false, 'error' => 'invalid_payload'], 400);
$csrf = (string)($body['csrf'] ?? '');
if (empty($_SESSION['minigames_csrf']) || !hash_equals($_SESSION['minigames_csrf'], $csrf)) {
    minigames_reply(['ok' => false, 'error' => 'csrf'], 400);
}

$allowedGames = ['quiz', 'maze', 'coins', 'barter', 'number_path', 'puzzle', 'color_lab', 'entrepreneur', 'clock'];
$game = (string)($body['game'] ?? '');
if (!in_array($game, $allowedGames, true)) minigames_reply(['ok' => false, 'error' => 'unknown_game'], 400);

$score = max(0, min(100, (int)($body['score'] ?? 0)));
$stars = $score >= 85 ? 3 : ($score >= 60 ? 2 : 1);
$progress = minigames_progress();
$previous = $progress['games'][$game] ?? [];
$progress['games'][$game] = [
    'attempts' => max(0, (int)($previous['attempts'] ?? 0)) + 1,
    'completed' => true,
    'bestScore' => max($score, (int)($previous['bestScore'] ?? 0)),
    'bestStars' => max($stars, (int)($previous['bestStars'] ?? 0)),
    'lastPlayed' => gmdate('c'),
];

if (!jsonfs_write('minigames/progress.json', $progress)) {
    minigames_reply(['ok' => false, 'error' => 'save_failed'], 500);
}
minigames_reply(['ok' => true, 'progress' => $progress, 'stars' => $stars]);
