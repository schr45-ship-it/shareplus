@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

title ai-shareplus - Fix n8n on VPS

cls
echo ==========================================
echo   ai-shareplus - Fix n8n on VPS
echo ==========================================
echo.
echo VPS IP: 157.180.83.77
echo.
echo This script will fix the n8n permission error
echo and configure all environment variables.
echo.
echo You will be asked for:
echo   1. Your VPS root password (once)
echo   2. Your API keys and secrets
echo.

set "SCRIPT_DIR=%~dp0"

REM Check for ssh
where ssh >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] OpenSSH Client is not enabled.
    echo Please enable it in Windows Settings -^> Optional Features.
    pause
    exit /b 1
)

echo Starting fix...
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%fix-n8n-vps.ps1"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ==========================================
    echo   Fix failed. Check errors above.
    echo ==========================================
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==========================================
echo   Fix complete!
echo ==========================================
echo.
echo Open http://157.180.83.77:5678 in your browser.
pause
exit /b 0
