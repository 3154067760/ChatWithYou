# 允许局域网访问 ChatWithYou（需管理员 PowerShell）
$ports = 3010, 5173
foreach ($port in $ports) {
  $name = "ChatWithYou Port $port"
  netsh advfirewall firewall delete rule name="$name" 2>$null | Out-Null
  netsh advfirewall firewall add rule name="$name" dir=in action=allow protocol=TCP localport=$port profile=private
  Write-Host "已放行 TCP $port"
}
Write-Host "完成。手机请访问 http://192.168.2.17:3010 (start:lan) 或 http://192.168.2.17:5173 (dev)"
