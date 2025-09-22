<?php
declare(strict_types=1);

function view(string $file, array $vars = []): void
{
    extract($vars, EXTR_OVERWRITE);
    require __DIR__ . "/views/$file";
}

function redirect(string $path): void
{
    header("Location: $path");
    exit;
}

function asset_url(string $path): string
{
    return base_url('assets/' . ltrim($path, '/'));
}

function post(string $key, $default = null)
{
    return $_POST[$key] ?? $default;
}

function get(string $key, $default = null)
{
    return $_GET[$key] ?? $default;
}

function csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (empty($_SESSION['_csrf'])) {
        $_SESSION['_csrf'] = bin2hex(random_bytes(16));
    }

    return $_SESSION['_csrf'];
}

function csrf_check(): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    return isset($_POST['_csrf']) && hash_equals($_SESSION['_csrf'] ?? '', $_POST['_csrf']);
}
