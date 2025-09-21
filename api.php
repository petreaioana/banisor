<?php
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/GameDefaults.php';
require_once __DIR__ . '/lib/GameRepository.php';
require_once __DIR__ . '/lib/AutoManager.php';
require_once __DIR__ . '/lib/GameEngine.php';

use Banisor\Game\GameEngine;
use Banisor\Game\GameRepository;

header('Content-Type: application/json; charset=utf-8');

$repository = new GameRepository();
$engine = new GameEngine();

function response(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function projectState(array $state): array
{
    return [
        'cash' => round($state['cash'] ?? 0, 2),
        'reputation' => round($state['reputation'] ?? 1.0, 2),
        'world' => $state['world'] ?? [],
        'policy' => $state['policy'] ?? [],
        'product' => [
            'name' => $state['product']['name'] ?? 'Produs',
            'price' => round($state['product']['price'] ?? 0, 2),
            'planned_qty' => $state['product']['planned_qty'] ?? 0,
            'stock_qty' => $state['product']['stock_qty'] ?? 0,
        ],
        'staff' => $state['staff'] ?? [],
        'plan' => $state['plan'] ?? [],
        'metrics' => [
            'sold_today' => $state['metrics']['sold_today'] ?? 0,
            'revenue_today' => round($state['metrics']['revenue_today'] ?? 0, 2),
            'profit_today' => round($state['metrics']['profit_today'] ?? 0, 2),
            'last_summary' => $state['metrics']['last_summary'] ?? null,
            'history' => $state['metrics']['history'] ?? [],
        ],
    ];
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw ?? '', true);
        if (!is_array($payload)) {
            $payload = $_POST;
        }

        $action = $payload['action'] ?? '';

        if ($action === 'reset') {
            $state = $repository->reset('default', 1000);
            response(['status' => 'ok', 'state' => projectState($state)]);
        }

        $state = $repository->loadState();
        $state = $engine->advanceToNow($state);

        switch ($action) {
            case 'set_focus':
                $focus = $payload['focus'] ?? 'balanced';
                if (!in_array($focus, ['balanced', 'profit', 'happy'], true)) {
                    $focus = 'balanced';
                }
                $state['policy']['focus'] = $focus;
                break;
            case 'toggle_smart':
                $current = $state['policy']['smart_manager'] ?? true;
                $state['policy']['smart_manager'] = !$current;
                break;
            default:
                // no-op
        }

        $repository->saveState($state);
        response(['status' => 'ok', 'state' => projectState($state)]);
    }

    $state = $repository->loadState();
    $state = $engine->advanceToNow($state);
    $repository->saveState($state);

    response(['status' => 'ok', 'state' => projectState($state)]);
} catch (\Throwable $e) {
    response([
        'status' => 'error',
        'message' => $e->getMessage(),
    ], 500);
}
