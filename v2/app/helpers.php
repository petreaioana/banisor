<?php
function view(string $file, array $vars = []) {
  extract($vars, EXTR_OVERWRITE);
  require __DIR__."/views/$file";
}
function redirect(string $path) {
  header("Location: $path"); exit;
}
function post($key, $default=null) { return $_POST[$key] ?? $default; }
function get($key, $default=null)  { return $_GET[$key]  ?? $default; }

function csrf_token(): string {
  if (session_status() !== PHP_SESSION_ACTIVE) session_start();
  if (empty($_SESSION['_csrf'])) $_SESSION['_csrf'] = bin2hex(random_bytes(16));
  return $_SESSION['_csrf'];
}
function csrf_check(): bool {
  if (session_status() !== PHP_SESSION_ACTIVE) session_start();
  return isset($_POST['_csrf']) && hash_equals($_SESSION['_csrf'] ?? '', $_POST['_csrf']);
}
