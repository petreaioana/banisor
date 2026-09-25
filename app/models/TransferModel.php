<?php
// app/models/TransferModel.php
declare(strict_types=1);

class TransferModel
{
  public static function read(int $profileId): array {
    $st = pdo()->prepare("SELECT qty, avg_q, COALESCE(buffs,'[]') AS buffs FROM fk_manual_transfer WHERE profile_id=?");
    $st->execute([$profileId]);
    $r = $st->fetch() ?: ['qty'=>0,'avg_q'=>0.86,'buffs'=>'[]'];
    $r['qty'] = (int)$r['qty'];
    $r['avg_q'] = (float)$r['avg_q'];
    $r['buffs'] = json_decode($r['buffs'], true) ?: [];
    return $r;
  }

  public static function add(int $profileId, int $addQty, float $q, bool $winBuff): void {
    $cur = self::read($profileId);
    $oldQty = $cur['qty']; $oldAvg = $cur['avg_q'];
    $newQty = max(0, $oldQty + max(0, $addQty));
    $newAvg = $newQty > 0 ? (($oldAvg*$oldQty)+($q*$addQty))/$newQty : $q;

    $buffs = $cur['buffs'];
    if ($winBuff) {
      $buffs[] = [
        'id' => 'freshBake', 'label'=>'Coacere perfectă',
        'trafficMult'=>1.08, 'qBonus'=>0.02,
        'minutes'=>45
      ];
    }
    $json = json_encode($buffs, JSON_UNESCAPED_UNICODE);
    $st = pdo()->prepare("INSERT INTO fk_manual_transfer (profile_id, qty, avg_q, buffs)
                          VALUES (?,?,?,?)
                          ON DUPLICATE KEY UPDATE qty=VALUES(qty), avg_q=VALUES(avg_q), buffs=VALUES(buffs)");
    $st->execute([$profileId, $newQty, round($newAvg,2), $json]);
  }

  public static function clear(int $profileId): void {
    $st = pdo()->prepare("UPDATE fk_manual_transfer SET qty=0, avg_q=0.86, buffs='[]' WHERE profile_id=?");
    $st->execute([$profileId]);
  }
}
