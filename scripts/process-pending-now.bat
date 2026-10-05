@echo off
setlocal
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\process-pending-now.ps1"
if errorlevel 1 (
  echo.
  echo Processing failed. Review the error above.
)
pause
