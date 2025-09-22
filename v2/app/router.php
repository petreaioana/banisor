<?php
require __DIR__.'/db.php';
require __DIR__.'/helpers.php';

require __DIR__.'/controllers/DashboardController.php';
require __DIR__.'/controllers/AtelierController.php';
require __DIR__.'/controllers/ApiController.php';

$R = get('r', 'dashboard.index'); // ex: ?r=atelier.index

switch ($R) {
  case 'dashboard.index': (new DashboardController())->index(); break;
  case 'dashboard.import': (new DashboardController())->importFromAtelier(); break;
  case 'dashboard.updateSettings': (new DashboardController())->updateSettings(); break;
case 'dashboard.pause': (new DashboardController())->pause(); break;
case 'dashboard.play':  (new DashboardController())->play();  break;
case 'dashboard.speed': (new DashboardController())->speed(); break;

  case 'atelier.index': (new AtelierController())->index(); break;
  case 'atelier.serve': (new AtelierController())->serve(); break; // form POST simplu
// router.php (adaugă lângă cele existente)
case 'atelier.index': (new AtelierController())->index(); break;
case 'atelier.serve': (new AtelierController())->serve(); break;     // POST
case 'atelier.reset': (new AtelierController())->reset(); break;     // GET

  // JSON API (minim JS)
  case 'api.transfer.state': (new ApiController())->transferState(); break;
  default:
    http_response_code(404);
    echo '404';
}
