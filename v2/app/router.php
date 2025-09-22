<?php
declare(strict_types=1);

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

foreach (['models', 'services', 'controllers'] as $directory) {
    foreach (glob(__DIR__ . "/{$directory}/*.php") ?: [] as $file) {
        require_once $file;
    }
}

$R = get('r', 'dashboard.index');

switch ($R) {
    case 'dashboard.index':
        (new DashboardController())->index();
        break;

    case 'dashboard.import':
        (new DashboardController())->importFromAtelier();
        break;

    case 'dashboard.updateSettings':
        (new DashboardController())->updateSettings();
        break;

    case 'dashboard.pause':
        (new DashboardController())->pause();
        break;

    case 'dashboard.play':
        (new DashboardController())->play();
        break;

    case 'dashboard.speed':
        (new DashboardController())->speed();
        break;

    case 'atelier.index':
        (new AtelierController())->index();
        break;

    case 'atelier.serve':
        (new AtelierController())->serve();
        break;

    case 'atelier.reset':
        (new AtelierController())->reset();
        break;

    case 'api.transfer.state':
        (new ApiController())->transferState();
        break;

    default:
        http_response_code(404);
        echo '404';
}
