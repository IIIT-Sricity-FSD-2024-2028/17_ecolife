$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root 'server.out.log'
$err = Join-Path $root 'server.err.log'
Remove-Item $out, $err -ErrorAction SilentlyContinue
$process = Start-Process -FilePath 'node' -ArgumentList 'dist\main.js' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
Start-Sleep -Seconds 10
try {
  $login = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:3000/api/auth/login' -ContentType 'application/json' -Body '{"email":"admin@rorizon.com","password":"Admin@123"}'
  "PID=$($process.Id); LOGIN=$($login.message)"
} catch {
  "PID=$($process.Id); ERROR=$($_.Exception.Message)"
  Get-Content $out -ErrorAction SilentlyContinue | Select-Object -Last 20
  Get-Content $err -ErrorAction SilentlyContinue | Select-Object -Last 20
}
