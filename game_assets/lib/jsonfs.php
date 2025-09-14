<?php
/**
 * jsonfs.php — utilitare pentru citire/scriere JSON pe disc (atomic, cu LOCK_EX)
 * Director bază: /data (creat automat dacă nu există)
 */

declare(strict_types=1);

if (!defined('JSONFS_BASE')) {
  define('JSONFS_BASE', __DIR__ . '/../data'); // /lib/../data
}

/** Creează recursiv un director dacă nu există. */
function jsonfs_ensure_dir(string $dir): bool {
  if (is_dir($dir)) return true;
  return @mkdir($dir, 0775, true);
}

/** Verifică și compune o cale sigură sub /data (fără ..) */
function jsonfs_path(string $relative): string {
  $rel = ltrim(str_replace('\\', '/', $relative), '/');
  if ($rel === '' || strpos($rel, '..') !== false) {
    throw new RuntimeException('Invalid JSONFS relative path: ' . $relative);
  }
  $full = rtrim(JSONFS_BASE, '/\\') . '/' . $rel;
  $dir  = dirname($full);
  jsonfs_ensure_dir($dir);
  return $full;
}

/** Citește JSON (sau întoarce default dacă lipsește/corupt). */
function jsonfs_read(string $relative, $default = []) {
  $file = jsonfs_path($relative);
  if (!is_file($file)) return $default;
  $raw = @file_get_contents($file);
  if ($raw === false || $raw === '') return $default;
  $data = json_decode($raw, true);
  return (is_array($data) || is_object($data)) ? $data : $default;
}

/** Scrie JSON atomic (cu .tmp + rename). */
function jsonfs_write(string $relative, $data): bool {
  $file = jsonfs_path($relative);
  $tmp  = $file . '.tmp';
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
  if ($json === false) return false;
  $ok = @file_put_contents($tmp, $json, LOCK_EX);
  if ($ok === false) return false;
  return @rename($tmp, $file);
}
