<div class="card shadow-sm mb-3">
  <div class="card-body">
    <div class="d-flex justify-content-between align-items-center">
      <div class="fw-bold"><?= htmlspecialchars($title ?? '') ?></div>
      <div class="fs-5"><?= $value ?? '' ?></div>
    </div>
    <?php if (isset($bar) && is_numeric($bar)): ?>
      <div class="progress mt-2"><div class="progress-bar" role="progressbar" style="width: <?= (int)$bar ?>%"></div></div>
    <?php endif; ?>
    <?php if (!empty($hint)): ?><div class="text-muted small mt-1"><?= htmlspecialchars($hint) ?></div><?php endif; ?>
  </div>
</div>
