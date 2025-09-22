<?php
class ApiController {
  public function transferState() {
    header('Content-Type: application/json; charset=utf-8');
    $cfg = require __DIR__.'/../config.php';
    $pid = (int)$cfg['profile_id'];
    echo json_encode(['ok'=>true,'transfer'=>TransferModel::read($pid)]);
  }
}
