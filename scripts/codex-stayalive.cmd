@echo off
setlocal

chcp 65001 >nul
set "PYTHONIOENCODING=utf-8"
set "CODEX_DISABLE_PROFILE_ERROR=1"

cd /d "%~dp0.."

set "CODEX_CMD=%APPDATA%\npm\codex.cmd"
if not exist "%CODEX_CMD%" set "CODEX_CMD=codex.cmd"

set "FIRST_RUN=1"

:loop
if defined FIRST_RUN (
  set "FIRST_RUN="
  call "%CODEX_CMD%" %*
) else (
  call "%CODEX_CMD%" resume --last
)

set "EXIT_CODE=%ERRORLEVEL%"
echo.
echo [codex-stayalive] Codex exited with code %EXIT_CODE%.
echo [codex-stayalive] Restarting in 2 seconds. Press Ctrl+C now to stop.
timeout /t 2 /nobreak >nul
goto loop
