$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

chcp 65001 > $null

$env:PYTHONIOENCODING = "utf-8"

Write-Host "UTF-8 shell initialized in $PWD"
