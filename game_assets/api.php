<?php
/**
 * FinKids Tycoon - API Router (JSON) pentru jocul manual si bridge-ul de transfer.
 * Endpoints:
 *  - GET  ?action=state
 *  - POST ?action=serve
 *  - GET  ?action=reset
 *  - GET  ?action=export [&clear=1]
 *  - GET  ?action=fetch_transfer [&clear=1]
 */

declare(strict_types=1);

require __DIR__ . '/lib/fk.php';
require __DIR__ . '/lib/jsonfs.php';

$action = $_GET['action'] ?? '';

function respond(array $payload, int $status = 200): void {
    http_response_code($status);
    json_out($payload);
}

function transfer_file(): string {
    return 'transfers/manual_to_auto.json';
}

function transfer_read(): array {
    $default = ['qty' => 0, 'avg_q' => 0.86, 'buffs' => []];
    $data = jsonfs_read(transfer_file(), $default);
    if (!is_array($data)) {
        return $default;
    }
    $data['qty']   = max(0, (int)($data['qty'] ?? 0));
    $data['avg_q'] = max(0.0, min(1.0, (float)($data['avg_q'] ?? 0.86)));
    $data['buffs'] = is_array($data['buffs'] ?? null) ? $data['buffs'] : [];
    return $data;
}

function transfer_write(array $data): bool {
    $data['qty']   = max(0, (int)($data['qty'] ?? 0));
    $data['avg_q'] = max(0.0, min(1.0, (float)($data['avg_q'] ?? 0.86)));
    $data['buffs'] = array_values(array_filter($data['buffs'] ?? [], static fn($b) => is_array($b)));
    return jsonfs_write(transfer_file(), $data);
}

function transfer_add(int $qty, float $q, bool $inWin): void {
    $qty = max(0, $qty);
    $q   = max(0.0, min(1.0, $q));
    if ($qty <= 0) {
        return;
    }

    $transfer = transfer_read();
    $oldQty = (int)($transfer['qty'] ?? 0);
    $oldAvg = (float)($transfer['avg_q'] ?? 0.86);
    $newQty = $oldQty + $qty;
    $newAvg = $newQty > 0 ? (($oldAvg * $oldQty) + ($q * $qty)) / $newQty : $q;

    $transfer['qty']   = $newQty;
    $transfer['avg_q'] = round($newAvg, 4);

    if ($inWin) {
        $transfer['buffs'] ??= [];
        $transfer['buffs'][] = [
            'id'          => 'freshBake',
            'label'       => 'Coacere perfecta',
            'trafficMult' => 1.08,
            'qBonus'      => 0.02,
            'expires'     => time() + 45 * 60,
        ];
    }

    transfer_write($transfer);
}

function transfer_payload(array $transfer): array {
    $now = time();
    $buffs = [];
    foreach ($transfer['buffs'] as $buff) {
        $buffs[] = [
            'id'           => $buff['id']    ?? 'buff',
            'label'        => $buff['label'] ?? 'Boost',
            'trafficMult'  => isset($buff['trafficMult']) ? (float)$buff['trafficMult'] : 1.0,
            'qBonus'       => isset($buff['qBonus']) ? (float)$buff['qBonus'] : 0.0,
            'seconds_left' => max(0, ((int)($buff['expires'] ?? $now)) - $now),
        ];
    }

    return [
        'qty'   => (int)($transfer['qty'] ?? 0),
        'avg_q' => (float)($transfer['avg_q'] ?? 0.86),
        'buffs' => $buffs,
    ];
}

switch ($action) {
    case 'state':
        respond(fk_state_response());
        break;

    case 'serve':
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            break;
        }
        fk_boot();
        $qty   = max(0, (int)($_POST['qty'] ?? 0));
        $q     = max(0.0, min(1.0, (float)($_POST['q'] ?? 0.90)));
        $inWin = isset($_POST['inWin']) && (int)$_POST['inWin'] === 1;

        fk_add_inventory($qty, $q);
        if ($inWin) {
            fk_add_buff('freshBake', 'Coacere perfecta', 45, 1.08, 0.02);
        }
        transfer_add($qty, $q, $inWin);

        respond([
            'ok'    => true,
            'state' => fk_state_response(),
        ]);
        break;

    case 'reset':
        unset($_SESSION['fk']);
        respond(['ok' => true, 'msg' => 'reset done']);
        break;

    case 'export':
        fk_boot();
        fk_buff_cleanup_and_recalc();
        $fk = $_SESSION['fk'];

        $now = time();
        $buffs = [];
        foreach ($fk['boost']['buffs'] as $buff) {
            $buffs[] = [
                'id'          => $buff['id'] ?? 'buff',
                'label'       => $buff['label'] ?? 'Boost',
                'trafficMult' => isset($buff['trafficMult']) ? (float)$buff['trafficMult'] : 1.0,
                'qBonus'      => isset($buff['qBonus']) ? (float)$buff['qBonus'] : 0.0,
                'seconds_left'=> max(0, ($buff['expires'] ?? $now) - $now),
            ];
        }

        $transfer = [
            'qty'   => (int)($fk['stock']['units'] ?? 0),
            'avg_q' => (float)($fk['stock']['avg_q'] ?? 0.86),
            'buffs' => $buffs,
        ];

        if (!empty($_GET['clear']) && (int)$_GET['clear'] === 1) {
            $_SESSION['fk']['stock']['units'] = 0;
            $_SESSION['fk']['boost']['buffs'] = [];
            $_SESSION['fk']['boost']['percent'] = 0;
        }

        respond(['ok' => true, 'transfer' => $transfer]);
        break;

    case 'fetch_transfer':
        $transfer = transfer_read();
        $now = time();
        $transfer['buffs'] = array_values(array_filter(
            $transfer['buffs'],
            static fn($buff) => (int)($buff['expires'] ?? 0) > $now
        ));
        $payload = transfer_payload($transfer);

        if (!empty($_GET['clear']) && (int)$_GET['clear'] === 1) {
            transfer_write(['qty' => 0, 'avg_q' => 0.86, 'buffs' => []]);
        }

        respond(['ok' => true, 'transfer' => $payload]);
        break;
}

respond(['ok' => false, 'error' => 'unknown action'], 404);
