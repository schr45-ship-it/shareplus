@echo off
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\deploy-n8n-v3.ps1"
if errorlevel 1 (
  echo.
  echo Setup failed. Review the error above.
)
pause
