<?php
namespace Banisor\Config;

use PDO;
use PDOException;

function getPDO(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = getenv('BANISOR_DB_HOST') ?: 'localhost';
    $name = getenv('BANISOR_DB_NAME') ?: 'u274298685_banisor';
    $user = getenv('BANISOR_DB_USER') ?: 'u274298685_banisor';
    $pass = getenv('BANISOR_DB_PASS') ?: '!Banisor2025';

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $host, $name);

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
    } catch (PDOException $e) {
        throw new PDOException('Database connection failed: ' . $e->getMessage(), (int)$e->getCode());
    }

    return $pdo;
}
