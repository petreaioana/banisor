<?php
declare(strict_types=1);

/**
 * FinKids Tycoon - Bootstrap
 * Rol: Inițializează sesiunea și încarcă librăriile esențiale.
 * Este inclus la începutul tuturor punctelor de intrare PHP (index.php, API).
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Definim o constantă globală pentru directorul rădăcină al proiectului.
// Acest lucru face ca includerea fișierelor din alte directoare să fie sigură și robustă.
if (!defined('PROJECT_ROOT')) {
    define('PROJECT_ROOT', dirname(__DIR__));
}

// Includem librăria pentru gestionarea fișierelor JSON.
require_once PROJECT_ROOT . '/includes/jsonfs.php';