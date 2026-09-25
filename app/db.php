<?php
declare(strict_types=1);

function app_config(): array
{
    static $config;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

function base_url(string $path = ''): string
{
    $cfg = app_config();
    $base = rtrim($cfg['base_url'] ?? '/', '/');
    $path = ltrim($path, '/');

    if ($base === '' || $base === '/') {
        return $path === '' ? '/' : '/' . $path;
    }

    return $path === '' ? $base : $base . '/' . $path;
}

function pdo(): PDO
{
    static $connection;

    if ($connection instanceof PDO) {
        return $connection;
    }

    $cfg = app_config()['db'] ?? [];
    $host = $cfg['host'] ?? 'localhost';
    $name = $cfg['name'] ?? '';
    $charset = $cfg['charset'] ?? 'utf8mb4';

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $host, $name, $charset);

    $connection = new PDO(
        $dsn,
        $cfg['user'] ?? '',
        $cfg['pass'] ?? '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    return $connection;
}
