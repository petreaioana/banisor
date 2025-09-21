<?php
declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/lib/GameDefaults.php';
require_once __DIR__ . '/lib/GameRepository.php';
require_once __DIR__ . '/lib/AutoManager.php';
require_once __DIR__ . '/lib/GameEngine.php';

use Banisor\Game\GameEngine;
use Banisor\Game\GameRepository;

$repository = new GameRepository();
$engine = new GameEngine();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    if ($action === 'reset') {
        $repository->reset('default', 1000);
        header('Location: index.php');
        exit;
    }

    $state = $repository->loadState();
    $state = $engine->advanceToNow($state);

    switch ($action) {
        case 'set_focus':
            $focus = $_POST['focus'] ?? 'balanced';
            if (!in_array($focus, ['balanced', 'profit', 'happy'], true)) {
                $focus = 'balanced';
            }
            $state['policy']['focus'] = $focus;
            break;
        case 'toggle_smart':
            $state['policy']['smart_manager'] = !($state['policy']['smart_manager'] ?? true);
            break;
    }

    $repository->saveState($state);
    header('Location: index.php');
    exit;
}

$state = $repository->loadState();
$state = $engine->advanceToNow($state);
$repository->saveState($state);

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

$plan = $state['plan'];
$metrics = $state['metrics'];
$policy = $state['policy'];
$world = $state['world'];
?>
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Banisor Idle Manager</title>
    <link rel="stylesheet" href="assets/css/main.css">
</head>
<body>
<header class="header">
    <div class="brand">
        <h1>Banisor Manager</h1>
        <p class="subtitle">Simulare idle cu auto-manager server-side</p>
    </div>
    <div class="timing">
        <span>Ziua <?= e((string)($world['day'] ?? 1)); ?></span>
        <span><?= e((string)($world['season'] ?? 'primăvară')); ?>, <?= e((string)($world['year'] ?? 1)); ?></span>
        <span><?= sprintf('%.02f', ($world['minute'] ?? 480) / 60); ?> h</span>
    </div>
</header>

<main class="layout">
    <section class="panel wide">
        <h2>Rezumat financiar</h2>
        <div class="grid stats">
            <div class="card">
                <span>Cash disponibil</span>
                <strong><?= number_format((float)($state['cash'] ?? 0), 2, ',', '.'); ?> lei</strong>
            </div>
            <div class="card">
                <span>Reputație</span>
                <strong><?= number_format((float)($state['reputation'] ?? 1), 2); ?></strong>
            </div>
            <div class="card">
                <span>Vândute azi</span>
                <strong id="stat-sold"><?= (int)($metrics['sold_today'] ?? 0); ?></strong>
            </div>
            <div class="card">
                <span>Venituri azi</span>
                <strong id="stat-revenue"><?= number_format((float)($metrics['revenue_today'] ?? 0), 2, ',', '.'); ?> lei</strong>
            </div>
            <div class="card">
                <span>Profit azi</span>
                <strong id="stat-profit"><?= number_format((float)($metrics['profit_today'] ?? 0), 2, ',', '.'); ?> lei</strong>
            </div>
        </div>
    </section>

    <section class="panel">
        <h2>Smart Manager</h2>
        <p class="muted">Modul inteligent planifică producția, prețul și personalul. Poți ajusta focusul în funcție de obiective.</p>
        <form method="post" class="form">
            <input type="hidden" name="action" value="set_focus">
            <fieldset>
                <legend>Alege focus-ul</legend>
                <label>
                    <input type="radio" name="focus" value="balanced" <?= ($policy['focus'] ?? 'balanced') === 'balanced' ? 'checked' : ''; ?>> Echilibru
                </label>
                <label>
                    <input type="radio" name="focus" value="profit" <?= ($policy['focus'] ?? 'balanced') === 'profit' ? 'checked' : ''; ?>> Profit
                </label>
                <label>
                    <input type="radio" name="focus" value="happy" <?= ($policy['focus'] ?? 'balanced') === 'happy' ? 'checked' : ''; ?>> Clienți fericiți
                </label>
            </fieldset>
            <button type="submit" class="btn primary">Aplică focus</button>
        </form>
        <form method="post" class="form-inline">
            <input type="hidden" name="action" value="toggle_smart">
            <button type="submit" class="btn secondary">
                <?= ($policy['smart_manager'] ?? true) ? 'Dezactivează Smart Manager' : 'Activează Smart Manager'; ?>
            </button>
        </form>
    </section>

    <section class="panel">
        <h2>Planul zilei</h2>
        <ul class="list">
            <li>Producem: <strong id="plan-qty"><?= (int)($plan['planned_qty'] ?? 0); ?></strong> buc</li>
            <li>Preț: <strong id="plan-price"><?= number_format((float)($plan['price'] ?? 0), 2, ',', '.'); ?> lei</strong></li>
            <li>Casieri: <strong id="plan-cashiers"><?= (int)($plan['cashiers'] ?? 1); ?></strong></li>
            <li>Clienți estimați: <strong id="plan-customers"><?= (int)($plan['expected_customers'] ?? 0); ?></strong></li>
        </ul>
    </section>

    <section class="panel">
        <h2>Ultima zi</h2>
        <?php if (!empty($metrics['last_summary'])): $summary = $metrics['last_summary']; ?>
            <ul class="list">
                <li>Vândute: <strong><?= (int)($summary['sold'] ?? 0); ?>/<?= (int)($summary['planned'] ?? 0); ?></strong></li>
                <li>Venituri: <strong><?= number_format((float)($summary['revenue'] ?? 0), 2, ',', '.'); ?> lei</strong></li>
                <li>Profit: <strong><?= number_format((float)($summary['profit'] ?? 0), 2, ',', '.'); ?> lei</strong></li>
                <li>Stele: <strong><?= str_repeat('★', (int)($summary['stars'] ?? 0)); ?></strong></li>
            </ul>
        <?php else: ?>
            <p class="muted">Începe ziua pentru a vedea un rezumat.</p>
        <?php endif; ?>
    </section>

    <section class="panel wide">
        <h2>Istoric</h2>
        <?php if (!empty($metrics['history'])): ?>
            <table class="history">
                <thead>
                    <tr>
                        <th>Ziua</th>
                        <th>Vândute</th>
                        <th>Venituri</th>
                        <th>Profit</th>
                        <th>Stele</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($metrics['history'] as $row): ?>
                    <tr>
                        <td><?= e((string)($row['day'] ?? '-')); ?></td>
                        <td><?= e((string)($row['sold'] ?? 0)); ?>/<?= e((string)($row['planned'] ?? 0)); ?></td>
                        <td><?= number_format((float)($row['revenue'] ?? 0), 2, ',', '.'); ?> lei</td>
                        <td><?= number_format((float)($row['profit'] ?? 0), 2, ',', '.'); ?> lei</td>
                        <td><?= str_repeat('★', (int)($row['stars'] ?? 0)); ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        <?php else: ?>
            <p class="muted">Nu există încă istoric. Joacă câteva zile!</p>
        <?php endif; ?>
    </section>

    <section class="panel danger">
        <h2>Resetare completă</h2>
        <p>Resetează jocul și pornește din nou cu 1&nbsp;000 lei. Operațiunea șterge definitiv progresul curent.</p>
        <form method="post" onsubmit="return confirm('Sigur vrei să ștergi progresul și să pornești din nou cu 1 000 lei?');">
            <input type="hidden" name="action" value="reset">
            <button type="submit" class="btn danger">Resetează jocul</button>
        </form>
    </section>
</main>

<script src="assets/js/panel.js" defer></script>
</body>
</html>
