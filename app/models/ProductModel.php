<?php
class ProductModel {
  public static function all(): array {
    return pdo()->query("SELECT * FROM fk_products ORDER BY id")->fetchAll();
  }
  public static function activeForProfile(int $profileId): array {
    $st = pdo()->prepare("
      SELECT p.*, pp.price, pp.planned_qty, pp.hh_enabled, pp.hh_start, pp.hh_end, pp.hh_discount_percent
      FROM fk_profiles pr
      JOIN fk_products p  ON p.id = pr.active_product_id
      JOIN fk_profile_products pp ON pp.product_id = p.id AND pp.profile_id = pr.id
      WHERE pr.id = ?
    ");
    $st->execute([$profileId]);
    return $st->fetch() ?: [];
  }
  public static function updateSettings(int $profileId, int $productId, array $data): void {
    $st = pdo()->prepare("
      UPDATE fk_profile_products
      SET price=?, planned_qty=?, hh_enabled=?, hh_start=?, hh_end=?, hh_discount_percent=?
      WHERE profile_id=? AND product_id=?
    ");
    $st->execute([
      (float)$data['price'],
      (int)$data['planned_qty'],
      (int)$data['hh_enabled'],
      $data['hh_start'],
      $data['hh_end'],
      (int)$data['hh_disc'],
      $profileId,
      $productId
    ]);
  }
}
