<?php
class InventoryModel {
  public static function totalStock(int $profileId, ?int $productId=null): int {
    if ($productId) {
      $st = pdo()->prepare("SELECT COALESCE(SUM(qty),0) s FROM fk_inventory_lot WHERE profile_id=? AND product_id=?");
      $st->execute([$profileId, $productId]);
    } else {
      $st = pdo()->prepare("SELECT COALESCE(SUM(qty),0) s FROM fk_inventory_lot WHERE profile_id=?");
      $st->execute([$profileId]);
    }
    return (int)($st->fetch()['s'] ?? 0);
  }
  public static function addLot(int $profileId, int $productId, int $qty, float $q): void {
    $st = pdo()->prepare("INSERT INTO fk_inventory_lot (profile_id, product_id, qty, q) VALUES (?,?,?,?)");
    $st->execute([$profileId, $productId, max(0,$qty), max(0,min(1,$q))]);
  }
}
