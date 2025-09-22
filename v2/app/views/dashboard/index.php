<?php
$title = 'Dashboard — FinKids Tycoon';
ob_start();
?>
<div class="row g-3">
  <div class="col-lg-4">
    <?php view('dashboard/_left_controls.php', compact('product')); ?>
  </div>
  <div class="col-lg-8">
    <?php view('dashboard/_right_metrics.php', compact('product','stock','boost')); ?>
  </div>
</div>
<?php
$content = ob_get_clean();
view('layouts/main.php', compact('title','content'));
