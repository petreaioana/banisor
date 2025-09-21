<?php
declare(strict_types=1);

/**
 * FinKids Tycoon - JSON File System Library
 * Rol: Oferă funcții sigure și atomice pentru citirea și scrierea fișierelor JSON pe disc.
 * Previne coruperea datelor prin utilizarea de fișiere temporare și blocare (LOCK_EX).
 */

// Directorul de bază pentru toate operațiunile JSONFS.
if (!defined('JSONFS_BASE')) {
    define('JSONFS_BASE', PROJECT_ROOT . '/game_assets/data');
}

/**
 * Asigură existența unui director. Îl creează recursiv dacă este necesar.
 *
 * @param string $dir Calea către director.
 * @return bool True dacă directorul există sau a fost creat cu succes.
 */
function jsonfs_ensure_dir(string $dir): bool {
    if (is_dir($dir)) {
        return true;
    }
    return @mkdir($dir, 0775, true);
}

/**
 * Construiește și validează o cale sigură către un fișier în directorul JSONFS_BASE.
 * Previne atacurile de tip "directory traversal" (../).
 *
 * @param string $relative_path Calea relativă a fișierului.
 * @return string Calea absolută și sigură către fișier.
 * @throws RuntimeException dacă calea este invalidă.
 */
function jsonfs_path(string $relative_path): string {
    // Curăță calea de caractere periculoase.
    $safe_path = ltrim(str_replace(['\\', '../'], ['/', ''], $relative_path), '/');
    if (empty($safe_path)) {
        throw new RuntimeException('Cale invalidă sau goală pentru jsonfs: ' . $relative_path);
    }
    
    $full_path = JSONFS_BASE . '/' . $safe_path;
    
    // Asigură că directorul părinte există.
    jsonfs_ensure_dir(dirname($full_path));
    
    return $full_path;
}

/**
 * Citește conținutul unui fișier JSON și îl decodează într-un array asociativ.
 *
 * @param string $relative_path Calea relativă a fișierului.
 * @param mixed $default Valoarea returnată dacă fișierul nu există sau este corupt.
 * @return mixed Array-ul decodat sau valoarea default.
 */
function jsonfs_read(string $relative_path, $default = []) {
    try {
        $file = jsonfs_path($relative_path);
    } catch (RuntimeException $e) {
        return $default;
    }

    if (!is_file($file) || !is_readable($file)) {
        return $default;
    }
    
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') {
        return $default;
    }
    
    $data = json_decode($raw, true);
    
    return json_last_error() === JSON_ERROR_NONE ? $data : $default;
}

/**
 * Scrie un array într-un fișier JSON într-un mod atomic (sigur).
 * Scrie mai întâi într-un fișier temporar, apoi îl redenumește pentru a preveni coruperea
 * datelor în caz de eroare la jumătatea scrierii.
 *
 * @param string $relative_path Calea relativă a fișierului.
 * @param mixed $data Datele de scris (de obicei un array).
 * @return bool True la succes, False la eșec.
 */
function jsonfs_write(string $relative_path, $data): bool {
    try {
        $file = jsonfs_path($relative_path);
    } catch (RuntimeException $e) {
        return false;
    }

    // Generează un nume de fișier temporar unic.
    $tmp_file = $file . '.tmp.' . bin2hex(random_bytes(4));
    
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }

    // Scrie în fișierul temporar cu blocare exclusivă.
    if (@file_put_contents($tmp_file, $json, LOCK_EX) === false) {
        // Șterge fișierul temporar dacă scrierea eșuează.
        if (file_exists($tmp_file)) {
            @unlink($tmp_file);
        }
        return false;
    }
    
    // Redenumește fișierul temporar la cel final (operațiune atomică).
    return @rename($tmp_file, $file);
}