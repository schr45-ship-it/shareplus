@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

title ai-shareplus - Setup n8n on VPS

cls
echo ==========================================
echo   ai-shareplus - Setup n8n on VPS
echo ==========================================
echo.
echo VPS IP: 157.180.83.77
echo.
echo This script will SSH into your VPS and:
echo   - Copy installation files
echo   - Install Docker, Caddy, n8n
echo   - Configure environment variables
echo   - Start n8n
echo.
echo You will be asked for your VPS password and API keys.
echo.

set "SCRIPT_DIR=%~dp0"

REM Check for ssh
where ssh >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] OpenSSH Client is not enabled.
    echo Please enable it in Windows Settings -> Optional Features.
    pause
    exit /b 1
)

echo Starting setup...
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-n8n-vps.ps1" -VpsIp "157.180.83.77" -SshUser "root"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ==========================================
    echo   Setup failed.
    echo ==========================================
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==========================================
echo   Setup complete!
echo ==========================================
pause
exit /b 0
