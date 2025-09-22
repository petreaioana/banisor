<?php
$cfg = require __DIR__.'/../../config.php';
$pid = (int)$cfg['profile_id'];
$profile = ProfileModel::getActive();
$product = ProductModel::activeForProfile($pid);
$stock   = InventoryModel::totalStock($pid, $product['id'] ?? null);
$boost   = BuffModel::aggregatePercent($pid);
?>
<nav class="navbar navbar-expand-lg bg-warning-subtle border-bottom sticky-top">
  <div class="container">
    <a class="navbar-brand fw-bold" href="?r=dashboard.index">🍪 FinKids</a>
    <div class="d-flex align-items-center gap-3 ms-auto">
      <span class="badge bg-light text-dark">Zi: <b><?= (int)$profile['id'] ?></b></span>
      <span>📦 Stoc: <b><?= (int)$stock ?></b></span>
      <span>⚡ Boost: <b><?= (int)$boost ?>%</b></span>
      <a class="btn btn-sm btn-outline-dark" href="?r=dashboard.import">📥 Import Atelier</a>
      <a class="btn btn-sm btn-dark" href="?r=atelier.index">🎮 Atelier</a>
    </div>
  </div>
</nav>
<div class="container mt-2">
  <?php view('partials/banisor.php'); ?>
</div>
