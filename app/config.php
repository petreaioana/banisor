<?php
// !!! Prod: mută aceste credențiale în env/secret.

$local = __DIR__ . '/config.local.php';
if (is_file($local)) {
  return require $local;
}
return [
  'db' => [
    'host' => 'localhost',
    'name' => 'u274298685_banisor',
    'user' => 'u274298685_banisor',
    'pass' => '[8qaf7m+YaJ',
    'charset' => 'utf8mb4',
  ],
  // profil activ (save-slot simplu): 1 by default
  'profile_id' => 1,
  'base_url' => '/', // schimbă dacă rulezi într-un subfolder
];
