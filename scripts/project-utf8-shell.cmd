@echo off
setlocal

chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"

powershell.exe -NoExit -ExecutionPolicy Bypass -NoLogo -File "%~dp0utf8-shell.ps1"
