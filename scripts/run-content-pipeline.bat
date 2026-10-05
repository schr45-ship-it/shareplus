@echo off
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\run-content-pipeline.ps1"
if errorlevel 1 (
  echo.
  echo Pipeline failed. Review the error above.
)
pause
