# Run once as Administrator to allow LAN access
$ports = @(3010, 5173)
foreach ($port in $ports) {
  $name = "ChatWithYou TCP $port"
  netsh advfirewall firewall show rule name="$name" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    netsh advfirewall firewall add rule name="$name" dir=in action=allow protocol=TCP localport=$port
    Write-Host "Added firewall rule: $name"
  } else {
    Write-Host "Rule exists: $name"
  }
}
Write-Host "Done. Phone URL: http://YOUR_PC_IP:3010"
