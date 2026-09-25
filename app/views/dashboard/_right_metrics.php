<?php
$running = (int)($profile['autosim_running'] ?? 1);
if ($running) {
  // meta-refresh soft ca să vezi “live” fără JS
  echo '<meta http-equiv="refresh" content="3" />';
}
?>
<div class="d-flex align-items-center gap-2 mb-3">
  <?php if ($running): ?>
    <a class="btn btn-outline-danger" href="?r=dashboard.pause">⏸️ Pauză</a>
  <?php else: ?>
    <a class="btn btn-success" href="?r=dashboard.play">▶️ Pornește</a>
  <?php endif; ?>

  <form method="post" action="?r=dashboard.speed" class="d-inline-flex align-items-center gap-2">
    <?php view('partials/form_csrf.php'); ?>
    <label class="form-label mb-0 small">Viteză</label>
    <select name="speed" class="form-select form-select-sm" style="width:auto">
      <?php foreach ([1,2,5,20] as $s): ?>
        <option value="<?= $s ?>" <?= ((int)$profile['autosim_speed'] === $s)?'selected':''; ?>><?= $s ?>x</option>
      <?php endforeach; ?>
    </select>
    <button class="btn btn-sm btn-outline-secondary">Set</button>
  </form>
</div>

<div class="row g-3">
  <div class="col-md-6">
    <?php view('partials/metric_card.php', ['title'=>'Stoc curent','value'=> (int)$stock.' buc','bar'=> min(100,(int)$stock)]); ?>
  </div>
  <div class="col-md-6">
    <?php view('partials/metric_card.php', ['title'=>'Boost','value'=> (int)$boost.'%','bar'=> (int)$boost, 'hint'=>'Bonus trafic & calitate']); ?>
  </div>

  <div class="col-12">
    <div class="card shadow-sm">
      <div class="card-body">
        <h6 class="fw-bold mb-3">Metrici live (azi)</h6>
        <div class="row">
          <div class="col-6 col-lg-3">Vândute: <b><?= (int)$agg['sold'] ?></b></div>
          <div class="col-6 col-lg-3">Venit: <b><?= number_format((float)$agg['rev'],0) ?></b> lei</div>
          <div class="col-6 col-lg-3">Q: <b><?= number_format((float)$agg['Q'],2) ?></b></div>
          <div class="col-6 col-lg-3">W: <b><?= number_format((float)$agg['W'],2) ?></b> min</div>
        </div>
      </div>
    </div>
  </div>
</div>
