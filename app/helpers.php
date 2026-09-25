<?php
declare(strict_types=1);

function log_directory(): string
{
    return __DIR__ . '/../storage/logs';
}

function log_file_path(): string
{
    return log_directory() . '/app.log';
}

function log_message(string $level, string $message, array $context = []): void
{
    $dir = log_directory();
    if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
        return;
    }

    if ($context !== []) {
        $message .= ' ' . json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    $timestamp = (new DateTimeImmutable())->format('Y-m-d H:i:s');
    $line = sprintf('[%s] %s: %s%s', $timestamp, strtoupper($level), $message, PHP_EOL);
    @file_put_contents(log_file_path(), $line, FILE_APPEND);
}

function register_error_logger(): void
{
    static $registered = false;

    if ($registered) {
        return;
    }

    $registered = true;

    ini_set('display_errors', '0');
    ini_set('display_startup_errors', '0');

    set_error_handler(function (int $severity, string $message, string $file = '', int $line = 0): bool {
        log_message('error', $message, [
            'severity' => $severity,
            'file' => $file,
            'line' => $line,
        ]);

        if (!(error_reporting() & $severity)) {
            return false;
        }

        throw new ErrorException($message, 0, $severity, $file, $line);
    });

    set_exception_handler(function (Throwable $exception): void {
        log_message('critical', $exception->getMessage(), [
            'exception' => get_class($exception),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString(),
        ]);

        http_response_code(500);
        echo 'A server error occurred. Please try again later.';
        exit;
    });

    register_shutdown_function(function (): void {
        $error = error_get_last();

        if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            log_message('critical', $error['message'], [
                'file' => $error['file'] ?? 'unknown',
                'line' => $error['line'] ?? 0,
                'type' => $error['type'],
            ]);
        }
    });
}

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
