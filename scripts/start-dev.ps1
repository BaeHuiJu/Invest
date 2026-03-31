$projectRoot = Split-Path -Parent $PSScriptRoot
$npmCmd = Join-Path $projectRoot "node_modules\.bin\npm.cmd"

if (-not (Test-Path $npmCmd)) {
  $npmCmd = "npm.cmd"
}

$command = "Set-Location -LiteralPath '$projectRoot'; & '$npmCmd' run dev"

Start-Process -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command `
  -WorkingDirectory $projectRoot

