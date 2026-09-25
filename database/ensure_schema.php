<?php
declare(strict_types=1);

/**
 * Schema bootstrap pentru FinKids Tycoon v2.
 * Rulează din CLI cu: php database/ensure_schema.php
 * Poate fi apelat și prin browser în mediul local. Operațiile păstrează datele existente.
 */

$root = dirname(__DIR__);
$localConfig = $root . '/app/config.local.php';
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Rulează scriptul din CLI: php database/ensure_schema.php\n");
}
if (!is_file($localConfig)) {
    throw new RuntimeException('Configurația locală lipsește. Schema nu va folosi configurația de hosting.');
}
$config = require $localConfig;
$db = $config['db'] ?? [];
$host = (string)($db['host'] ?? 'localhost');
$name = (string)($db['name'] ?? 'banisor');
$user = (string)($db['user'] ?? 'root');
$pass = (string)($db['pass'] ?? '');
$charset = (string)($db['charset'] ?? 'utf8mb4');

if (!preg_match('/^[A-Za-z0-9_]+$/', $name)) {
    throw new RuntimeException('Numele bazei de date nu este valid.');
}

$options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false];
$server = new PDO(sprintf('mysql:host=%s;charset=%s', $host, $charset), $user, $pass, $options);
$server->exec(sprintf('CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', $name));
$pdo = new PDO(sprintf('mysql:host=%s;dbname=%s;charset=%s', $host, $name, $charset), $user, $pass, $options);

$tables = [
    'fk_profiles' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_profiles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL DEFAULT 'Bănișor',
  cash DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  season ENUM('primavara','vara','toamna','iarna') NOT NULL DEFAULT 'primavara',
  day_num TINYINT UNSIGNED NOT NULL DEFAULT 1,
  time_min SMALLINT UNSIGNED NOT NULL DEFAULT 480,
  open_min SMALLINT UNSIGNED NOT NULL DEFAULT 480,
  close_min SMALLINT UNSIGNED NOT NULL DEFAULT 960,
  reputation DECIMAL(5,3) NOT NULL DEFAULT 1.000,
  economy_index DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  hh_social_today TINYINT(1) NOT NULL DEFAULT 0,
  flyer_days_left TINYINT UNSIGNED NOT NULL DEFAULT 0,
  autosim_running TINYINT(1) NOT NULL DEFAULT 1,
  autosim_speed TINYINT UNSIGNED NOT NULL DEFAULT 1,
  last_tick_at DATETIME NULL,
  meta_weather VARCHAR(16) NOT NULL DEFAULT 'sunny',
  active_product_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    'fk_products' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  recipe_id VARCHAR(64) NOT NULL,
  P0 DECIMAL(8,2) NOT NULL DEFAULT 10.00,
  cost_ingredients DECIMAL(8,2) NOT NULL DEFAULT 3.00,
  cost_labor_var DECIMAL(8,2) NOT NULL DEFAULT 0.50,
  shelf_life_days TINYINT UNSIGNED NOT NULL DEFAULT 2,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fk_products_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    'fk_profile_products' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_profile_products (
  profile_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  price DECIMAL(8,2) NOT NULL DEFAULT 10.00,
  planned_qty INT UNSIGNED NOT NULL DEFAULT 100,
  hh_enabled TINYINT(1) NOT NULL DEFAULT 1,
  hh_start TIME NOT NULL DEFAULT '16:00:00',
  hh_end TIME NOT NULL DEFAULT '17:00:00',
  hh_discount_percent TINYINT UNSIGNED NOT NULL DEFAULT 10,
  upgraded_oven TINYINT(1) NOT NULL DEFAULT 0,
  upgraded_pos TINYINT(1) NOT NULL DEFAULT 0,
  upgraded_auto TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, product_id),
  CONSTRAINT fk_profile_products_profile FOREIGN KEY (profile_id) REFERENCES fk_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_profile_products_product FOREIGN KEY (product_id) REFERENCES fk_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    'fk_ingredients' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_ingredients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id INT UNSIGNED NOT NULL,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  qty INT UNSIGNED NOT NULL DEFAULT 0,
  unit_cost DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fk_ingredients_profile_code (profile_id, code),
  CONSTRAINT fk_ingredients_profile FOREIGN KEY (profile_id) REFERENCES fk_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    'fk_inventory_lot' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_inventory_lot (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  qty INT UNSIGNED NOT NULL DEFAULT 0,
  q DECIMAL(4,3) NOT NULL DEFAULT 0.860,
  age_days TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_fk_inventory_profile_product_qty (profile_id, product_id, qty, id),
  CONSTRAINT fk_inventory_profile FOREIGN KEY (profile_id) REFERENCES fk_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES fk_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    'fk_buffs' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_buffs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id INT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  traffic_mult DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  q_bonus DECIMAL(5,3) NOT NULL DEFAULT 0.000,
  w_bonus DECIMAL(5,3) NOT NULL DEFAULT 0.000,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_fk_buffs_profile_expiry (profile_id, expires_at),
  CONSTRAINT fk_buffs_profile FOREIGN KEY (profile_id) REFERENCES fk_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    'fk_manual_transfer' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_manual_transfer (
  profile_id INT UNSIGNED NOT NULL,
  qty INT UNSIGNED NOT NULL DEFAULT 0,
  avg_q DECIMAL(4,3) NOT NULL DEFAULT 0.860,
  buffs JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id),
  CONSTRAINT fk_manual_transfer_profile FOREIGN KEY (profile_id) REFERENCES fk_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    'fk_autosim_agg_current' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_autosim_agg_current (
  profile_id INT UNSIGNED NOT NULL,
  sold INT UNSIGNED NOT NULL DEFAULT 0,
  rev DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  cogs DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  N INT UNSIGNED NOT NULL DEFAULT 0,
  C DECIMAL(5,3) NOT NULL DEFAULT 0.000,
  W DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  Q DECIMAL(4,3) NOT NULL DEFAULT 0.000,
  PRIMARY KEY (profile_id),
  CONSTRAINT fk_autosim_agg_profile FOREIGN KEY (profile_id) REFERENCES fk_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
    'fk_daily_reports' => <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_daily_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id INT UNSIGNED NOT NULL,
  season ENUM('primavara','vara','toamna','iarna') NOT NULL,
  day_num TINYINT UNSIGNED NOT NULL,
  sold INT UNSIGNED NOT NULL DEFAULT 0,
  revenue DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  cogs DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  holding DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  marketing DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  fixed DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payroll DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  profit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  q_avg DECIMAL(4,3) NOT NULL DEFAULT 0.000,
  w_avg DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  c_avg DECIMAL(5,3) NOT NULL DEFAULT 0.000,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_fk_daily_reports_profile_day (profile_id, id),
  CONSTRAINT fk_daily_reports_profile FOREIGN KEY (profile_id) REFERENCES fk_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
SQL,
];

foreach ($tables as $sql) {
    $pdo->exec($sql);
}

$pdo->exec("INSERT IGNORE INTO fk_products (code,name,recipe_id,P0,cost_ingredients,cost_labor_var,shelf_life_days) VALUES
  ('croissant','Croissant','croissant_plain',10.00,3.00,0.50,2),
  ('donut','Gogoașă','donut_plain',9.00,2.80,0.50,2),
  ('eclair','Ecler vanilie','eclair_vanilla',12.00,4.20,0.60,2),
  ('muffin','Brioșă cu afine','muffin_blueberry',11.00,3.80,0.50,2)");
$pdo->exec("INSERT IGNORE INTO fk_profiles (id,name) VALUES (1,'Bănișor')");
$pdo->exec("UPDATE fk_profiles SET active_product_id = (SELECT id FROM fk_products WHERE code='croissant' LIMIT 1) WHERE id=1 AND active_product_id IS NULL");
$pdo->exec("INSERT IGNORE INTO fk_profile_products (profile_id,product_id,price,planned_qty,hh_enabled,hh_start,hh_end,hh_discount_percent) SELECT 1,id,P0,100,1,'16:00:00','17:00:00',10 FROM fk_products");
$pdo->exec("INSERT IGNORE INTO fk_ingredients (profile_id,code,name,qty,unit_cost) VALUES
  (1,'flour','Făină',1000,0.02),(1,'milk','Lapte',500,0.08),(1,'sugar','Zahăr',500,0.04),
  (1,'butter','Unt',300,0.15),(1,'eggs','Ouă',300,0.20),(1,'yeast','Drojdie',200,0.05),
  (1,'vanilla','Vanilie',100,0.25),(1,'cream','Cremă',200,0.18),(1,'blueberries','Afine',200,0.30),(1,'strawberries','Căpșuni',200,0.25)");
$pdo->exec("INSERT IGNORE INTO fk_manual_transfer (profile_id,qty,avg_q,buffs) VALUES (1,0,0.860,'[]')");
$pdo->exec("INSERT IGNORE INTO fk_autosim_agg_current (profile_id) VALUES (1)");

$result = ['ok' => true, 'database' => $name, 'tables' => array_keys($tables)];
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
