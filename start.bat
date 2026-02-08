@echo off
REM ================================================================
REM  start.bat - Windows launcher for LocalLLM Hub
REM  Double-click this file or run from Command Prompt
REM ================================================================

setlocal enabledelayedexpansion

REM ── colors (limited in CMD but we try) ──────────────────────
echo.
echo ================================================
echo    LocalLLM Hub - Dev Server (Windows)
echo ================================================
echo   Backend  : http://localhost:3001
echo   Frontend : http://localhost:5173
echo ================================================
echo.

REM ── check for node_modules ──────────────────────────────────
if not exist "node_modules" (
    echo [!] node_modules not found - running npm install...
    call npm install
    if errorlevel 1 (
        echo [X] npm install failed!
        pause
        exit /b 1
    )
    echo.
)

REM ── check if port 3001 is in use ────────────────────────────
echo [*] Checking if port 3001 is available...
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [!] Port 3001 is already in use.
    echo [*] Finding process ID...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
        echo [*] Killing process %%a...
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    echo [OK] Port cleared.
    echo.
)

REM ── launch ──────────────────────────────────────────────────
echo [*] Starting LocalLLM Hub...
echo.
call npm run dev

REM If npm run dev exits, pause so user can see any errors
if errorlevel 1 (
    echo.
    echo [X] Server stopped with errors.
    pause
) else (
    echo.
    echo [*] Server stopped.
)
