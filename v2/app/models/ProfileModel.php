<?php
class ProfileModel {
  public static function getActive(): array {
    $cfg = require __DIR__.'/../config.php';
    $pid = (int)$cfg['profile_id'];
    $st = pdo()->prepare("SELECT * FROM fk_profiles WHERE id=?");
    $st->execute([$pid]);
    return $st->fetch() ?: [];
  }
}
