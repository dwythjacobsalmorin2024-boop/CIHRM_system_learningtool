<?php
function e($v): string { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
function user(): ?array { return $_SESSION['user'] ?? null; }
function require_login(): void { if (!user()) { header('Location: index.php?page=login'); exit; } }
function require_role(array $roles): void { require_login(); if (!in_array(user()['role'], $roles, true)) { http_response_code(403); exit('Access denied.'); } }
function redirect(string $url): never { header("Location: $url"); exit; }
function flash(string $msg, string $type='success'): void { $_SESSION['flash']=['msg'=>$msg,'type'=>$type]; }
function csrf_field(): string { if (empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32)); return '<input type="hidden" name="csrf" value="'.e($_SESSION['csrf']).'">'; }
function verify_csrf(): void { if (!hash_equals($_SESSION['csrf'] ?? '', $_POST['csrf'] ?? '')) { http_response_code(419); exit('Invalid session token. Refresh and try again.'); } }
function log_activity(PDO $pdo, string $action): void { if (user()) { $s=$pdo->prepare('INSERT INTO activity_log(user_id,action) VALUES(?,?)'); $s->execute([user()['user_id'],$action]); } }
function money($n): string { return '₱'.number_format((float)$n,2); }
function nights(string $in, string $out): int { return max(0,(int)((strtotime($out)-strtotime($in))/86400)); }
function room_is_free(PDO $pdo,int $room,string $in,string $out,?int $exclude=null): bool {
 $sql="SELECT COUNT(*) FROM reservation WHERE room_id=? AND reservation_status IN ('Pending','Confirmed','Checked-in') AND check_in_date < ? AND check_out_date > ?";
 $args=[$room,$out,$in]; if($exclude){$sql.=" AND reservation_id<>?";$args[]=$exclude;}
 $s=$pdo->prepare($sql);$s->execute($args);return (int)$s->fetchColumn()===0;
}
