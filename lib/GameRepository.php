<?php
namespace Banisor\Game;

use Banisor\Config;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use RuntimeException;

final class GameRepository
{
    private PDO $pdo;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? Config\getPDO();
        $this->initialise();
    }

    private function initialise(): void
    {
        $sql = <<<'SQL'
CREATE TABLE IF NOT EXISTS fk_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_token VARCHAR(64) NOT NULL UNIQUE,
    state_json LONGTEXT NOT NULL,
    last_tick DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL;

        $this->pdo->exec($sql);
    }

    public function loadState(string $userToken = 'default'): array
    {
        $stmt = $this->pdo->prepare('SELECT state_json, last_tick FROM fk_profiles WHERE user_token = :token LIMIT 1');
        $stmt->execute(['token' => $userToken]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return $this->createProfile($userToken, 1000);
        }

        $state = json_decode($row['state_json'], true);
        if (!is_array($state)) {
            throw new RuntimeException('Stored state is corrupted.');
        }

        $state['meta']['last_tick'] = (new DateTimeImmutable($row['last_tick'], new DateTimeZone('UTC')))->format(DATE_ATOM);
        return $state;
    }

    public function saveState(array $state, string $userToken = 'default'): void
    {
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $state['meta']['last_tick'] = $state['meta']['last_tick'] ?? $now->format(DATE_ATOM);

        $payload = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($payload === false) {
            throw new RuntimeException('Unable to encode game state.');
        }

        $sql = 'UPDATE fk_profiles SET state_json = :state, last_tick = :tick, updated_at = :now WHERE user_token = :token';
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'state' => $payload,
            'tick' => (new DateTimeImmutable($state['meta']['last_tick']))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
            'now' => $now->format('Y-m-d H:i:s'),
            'token' => $userToken,
        ]);

        if ($stmt->rowCount() === 0) {
            // profile might not exist (e.g., manual truncare) — recreăm starea
            $this->createProfile($userToken, (int) ($state['cash'] ?? 1000), $state);
        }
    }

    public function reset(string $userToken = 'default', int $startCash = 1000): array
    {
        return $this->createProfile($userToken, $startCash);
    }

    private function createProfile(string $userToken, int $startCash, ?array $state = null): array
    {
        $state = $state ?? GameDefaults::create($startCash);
        $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $state['cash'] = $startCash;
        $state['meta']['last_tick'] = $now->format(DATE_ATOM);

        $payload = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($payload === false) {
            throw new RuntimeException('Unable to encode default game state.');
        }

        $sql = 'INSERT INTO fk_profiles (user_token, state_json, last_tick, created_at, updated_at) VALUES (:token, :state, :tick, :now, :now)
                ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), last_tick = VALUES(last_tick), updated_at = VALUES(updated_at)';
        $this->pdo->prepare($sql)->execute([
            'token' => $userToken,
            'state' => $payload,
            'tick' => $now->format('Y-m-d H:i:s'),
            'now' => $now->format('Y-m-d H:i:s'),
        ]);

        return $state;
    }
}

