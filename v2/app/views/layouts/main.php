<?php /* $title, $content come from child */ ?>
<!doctype html>
<html lang="ro">
<?php view('partials/head.php', ['title' => $title ?? 'FinKids Tycoon']); ?>
<body>
  <?php view('partials/navbar.php', $navbar ?? []); ?>
  <main class="container py-3">
    <?= $content ?? '' ?>
  </main>
  <?php view('partials/footer.php'); ?>
  <?php view('partials/toasts.php'); ?>
</body>
</html>
h