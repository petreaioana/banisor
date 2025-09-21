<?php
require_once __DIR__ . "/../../config/database.php";
require_once __DIR__ . "/../../lib/GameDefaults.php";
require_once __DIR__ . "/../../lib/GameRepository.php";

use Banisor\Game\GameRepository;

$repository = new GameRepository();
$repository->reset('default', 1000);

echo "fk_profiles table ensured and default profile created." . PHP_EOL;
