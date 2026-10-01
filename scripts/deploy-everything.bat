@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

title ai-shareplus - Deploy Everything

cls
echo ==========================================
echo   ai-shareplus - Deploy to Live Site
echo ==========================================
echo.
echo This script will deploy the frontend to Vercel.
echo.
echo Prerequisites:
echo   1. Node.js installed (https://nodejs.org)
echo   2. .env.local file filled in frontend/ folder
echo   3. Vercel account
echo.

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "FRONTEND_DIR=%PROJECT_DIR%\frontend"

REM Check Node.js
call :check_command node
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org and try again.
    pause
    exit /b 1
)

REM Check .env.local
if not exist "%FRONTEND_DIR%\.env.local" (
    echo [ERROR] .env.local not found in %FRONTEND_DIR%
    echo Please create it from env.example and fill in your real values.
    echo.
    echo Example command:
    echo   copy "%FRONTEND_DIR%\env.example" "%FRONTEND_DIR%\.env.local"
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found.
echo [OK] .env.local found.
echo.

REM Run the PowerShell deploy script
echo Starting Vercel deployment...
echo.
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%deploy-live.ps1"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ==========================================
    echo   Deployment failed.
    echo ==========================================
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==========================================
echo   Deployment completed successfully!
echo ==========================================
echo.

REM Ask if user also wants to push to GitHub
set /p PUSH_GITHUB="Do you also want to push this code to GitHub? (y/n): "
if /I "!PUSH_GITHUB!"=="y" (
    echo.
    echo Pushing to GitHub...
    powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%push-to-github.ps1"
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [WARNING] GitHub push may have failed. Check errors above.
        pause
        exit /b %ERRORLEVEL%
    )
)

echo.
echo Done! Check Vercel Dashboard for your live URL.
pause
exit /b 0

:check_command
where %~1 >nul 2>nul
exit /b %ERRORLEVEL%
