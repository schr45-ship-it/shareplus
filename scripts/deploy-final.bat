@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

title ai-shareplus - Deploy to Production (GitHub + Vercel)

cls
echo ==========================================
echo   ai-shareplus - Production Deploy
echo ==========================================
echo.
echo This script will:
echo   1. Install Git if not present
echo   2. Push code to GitHub master
echo   3. Trigger Vercel Production Deployment
echo.
echo Repository: https://github.com/schr45-ship-it/shareplus.git
echo.

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

cd /d "%PROJECT_DIR%"

REM Check Node.js
call :check_command node
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js found.
echo.

REM Run the GitHub push PowerShell script
echo Pushing code to GitHub master branch...
echo.
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%push-to-github.ps1" -RepoUrl "https://github.com/schr45-ship-it/shareplus.git"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ==========================================
    echo   Push to GitHub failed.
    echo ==========================================
    echo.
    echo Common fixes:
    echo   1. Install GitHub CLI and run: gh auth login
    echo   2. Or set up a GitHub personal access token
    echo   3. Or push manually from GitHub Desktop
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==========================================
echo   Push to GitHub succeeded!
echo ==========================================
echo.
echo Vercel should now start a Production Deployment automatically.
echo.
echo You can watch the build at:
echo   https://vercel.com/thesteps/shareplus
echo.
echo Opening Vercel dashboard...
start https://vercel.com/thesteps/shareplus

pause
exit /b 0

:check_command
where %~1 >nul 2>nul
exit /b %ERRORLEVEL%
