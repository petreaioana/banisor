<?php
declare(strict_types=1);

/**
 * FinKids Tycoon - API pentru Jocul Manual
 * Rol: Gestionează acțiunile venite de la game.js (servire, reset, etc.).
 * Lucrează direct cu un fișier JSON de transfer, eliminând dependența de sesiunea PHP.
 */

require_once __DIR__ . '/../includes/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

/** Calea constantă către fișierul de transfer. */
const TRANSFER_FILE = 'manual_transfer.json';

/**
 * Trimite un răspuns JSON standardizat și oprește execuția scriptului.
 * @param array $data Datele de trimis.
 * @param int $status_code Codul de status HTTP.
 */
function json_response(array $data, int $status_code = 200): void {
    http_response_code($status_code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Citește, curăță și formatează starea curentă a transferului pentru a fi trimisă clientului.
 * @return array Starea formatată.
 */
function get_transfer_state(): array {
    $state = jsonfs_read(TRANSFER_FILE, ['qty' => 0, 'avg_q' => 0.86, 'buffs' => []]);
    $now = time();

    // 1. Filtrează buff-urile expirate înainte de a face orice altceva.
    $active_buffs = array_values(array_filter($state['buffs'] ?? [], function($b) use ($now) {
        return ($b['expires'] ?? 0) > $now;
    }));

    // 2. Pregătește payload-ul pentru client (calculează `seconds_left`).
    $payload_buffs = array_map(function($b) use ($now) {
        return [
            'id'           => $b['id'] ?? 'buff',
            'label'        => $b['label'] ?? 'Boost',
            'trafficMult'  => floatval($b['trafficMult'] ?? 1.0),
            'qBonus'       => floatval($b['qBonus'] ?? 0.0),
            'seconds_left' => max(0, intval($b['expires'] ?? $now) - $now),
        ];
    }, $active_buffs);
    
    // 3. Calculează procentul de boost total pentru afișaj.
    $total_traffic_mult = array_reduce($payload_buffs, fn($carry, $b) => $carry * $b['trafficMult'], 1.0);
    $percent = round(($total_traffic_mult - 1.0) * 100);

    return [
        'qty'     => intval($state['qty'] ?? 0),
        'avg_q'   => floatval($state['avg_q'] ?? 0.86),
        'buffs'   => $payload_buffs,
        'percent' => $percent,
    ];
}


// =====================================================
// ROUTER API SIMPLIFICAT
// =====================================================
$action = $_GET['action'] ?? null;

switch ($action) {
    case 'state':
    case 'fetch_transfer':
        $transfer_data = get_transfer_state();
        $should_clear = isset($_GET['clear']) && intval($_GET['clear']) === 1;

        if ($should_clear) {
            // Golește fișierul de transfer la cerere.
            jsonfs_write(TRANSFER_FILE, ['qty' => 0, 'avg_q' => 0.86, 'buffs' => []]);
        }
        
        // Numele cheii "transfer" este așteptat de engine.js
        json_response(['ok' => true, 'transfer' => $transfer_data]);
        break;

    case 'serve':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['ok' => false, 'error' => 'Metodă HTTP invalidă. Se acceptă doar POST.'], 405);
        }

        $qty = isset($_POST['qty']) ? intval($_POST['qty']) : 0;
        $q = isset($_POST['q']) ? floatval($_POST['q']) : 0.86;
        $inWin = isset($_POST['inWin']) && intval($_POST['inWin']) === 1;

        if ($qty <= 0) {
            json_response(['ok' => true, 'state' => get_transfer_state()]);
        }

        $state = jsonfs_read(TRANSFER_FILE, ['qty' => 0, 'avg_q' => 0.86, 'buffs' => []]);

        // Recalculează media ponderată a calității.
        $old_qty = $state['qty'] ?? 0;
        $old_avg_q = $state['avg_q'] ?? 0.86;
        $new_qty = $old_qty + $qty;
        $new_avg_q = $new_qty > 0 ? (($old_avg_q * $old_qty) + ($q * $qty)) / $new_qty : $q;

        $state['qty'] = $new_qty;
        $state['avg_q'] = round($new_avg_q, 4);
        
        // Adaugă buff dacă a fost coacere perfectă.
        if ($inWin) {
            $state['buffs'][] = [
                'id'          => 'freshBake_' . time(),
                'label'       => 'Coacere perfectă',
                'trafficMult' => 1.08,
                'qBonus'      => 0.02,
                'expires'     => time() + 45 * 60, // Valabil 45 de minute
            ];
        }
        
        jsonfs_write(TRANSFER_FILE, $state);

        json_response(['ok' => true, 'state' => get_transfer_state()]);
        break;

    case 'reset':
        // Golește fișierul de transfer.
        jsonfs_write(TRANSFER_FILE, ['qty' => 0, 'avg_q' => 0.86, 'buffs' => []]);
        json_response(['ok' => true, 'message' => 'Progresul jocului manual a fost resetat.']);
        break;

    default:
        json_response(['ok' => false, 'error' => 'Acțiune necunoscută.'], 404);
        break;
}