<div class="card shadow-sm">
  <div class="card-body">
    <h5 class="card-title mb-3">Parametri produs activ: <b><?= htmlspecialchars($product['name'] ?? '-') ?></b></h5>
    <form method="post" action="?r=dashboard.updateSettings" class="row g-3">
      <?php view('partials/form_csrf.php'); ?>
      <input type="hidden" name="product_id" value="<?= (int)($product['id'] ?? 0) ?>">
      <div class="col-6">
        <label class="form-label">Preț (lei)</label>
        <input type="number" step="0.1" class="form-control" name="price" value="<?= (float)($product['price'] ?? 10) ?>">
      </div>
      <div class="col-6">
        <label class="form-label">Lot planificat (buc)</label>
        <input type="number" step="1" class="form-control" name="planned_qty" value="<?= (int)($product['planned_qty'] ?? 100) ?>">
      </div>
      <div class="col-12">
        <label class="form-label">Happy Hour</label>
        <div class="row g-2">
          <div class="col-3">
            <div class="form-check mt-2">
              <input class="form-check-input" type="checkbox" name="hh_enabled" value="1" <?= !empty($product['hh_enabled'])?'checked':''; ?>>
              <label class="form-check-label">Activ</label>
            </div>
          </div>
          <div class="col-3">
            <input type="time" class="form-control" name="hh_start" value="<?= htmlspecialchars(substr($product['hh_start']??'16:00:00',0,5)) ?>">
          </div>
          <div class="col-3">
            <input type="time" class="form-control" name="hh_end" value="<?= htmlspecialchars(substr($product['hh_end']??'17:00:00',0,5)) ?>">
          </div>
          <div class="col-3">
            <input type="number" class="form-control" min="5" max="25" name="hh_disc" value="<?= (int)($product['hh_discount_percent'] ?? 10) ?>">
          </div>
        </div>
      </div>
      <div class="col-12 d-grid">
        <button class="btn btn-dark">💾 Salvează</button>
      </div>
      <div class="col-12 d-grid">
        <a class="btn btn-outline-primary" href="?r=dashboard.import">📥 Import din Atelier (transfer DB)</a>
      </div>
    </form>
  </div>
</div>
