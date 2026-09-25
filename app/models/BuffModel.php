<?php
class BuffModel {
  public static function active(int $profileId): array {
    $st = pdo()->prepare("SELECT * FROM fk_buffs WHERE profile_id=? AND expires_at > NOW() ORDER BY expires_at");
    $st->execute([$profileId]);
    return $st->fetchAll();
  }
  public static function aggregatePercent(int $profileId): int {
    $buffs = self::active($profileId);
    $mult = 1.0; $qBonus = 0.0; $wBonus = 0.0;
    foreach ($buffs as $b) {
      $mult *= (float)$b['traffic_mult'];
      $qBonus += (float)$b['q_bonus'];
      $wBonus += (float)$b['w_bonus'];
    }
    $percent = ($mult - 1.0) * 200 + $qBonus * 800 - $wBonus * 40; // aceeași idee ca jocul
    return max(0, min(100, (int)round($percent)));
  }
  public static function addTimed(int $profileId, string $label, float $trafficMult=1.0, float $qBonus=0.0, float $wBonus=0.0, int $minutes=45): void {
    $st = pdo()->prepare("INSERT INTO fk_buffs (profile_id,label,traffic_mult,q_bonus,w_bonus,expires_at) VALUES (?,?,?,?,?, DATE_ADD(NOW(), INTERVAL ? MINUTE))");
    $st->execute([$profileId, $label, $trafficMult, $qBonus, $wBonus, $minutes]);
  }
}
