@echo off
REM ============================================================
REM  VitalSync rPPG — Start Script (Windows)
REM ============================================================
setlocal EnableDelayedExpansion

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

echo.
echo  ╔══════════════════════════════════════╗
echo  ║   VitalSync rPPG — v3  Starting...   ║
echo  ╚══════════════════════════════════════╝
echo.

REM ── Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] python not found. Install Python 3.9+ from python.org
    pause & exit /b 1
)
echo [OK] Python found

REM ── Check Node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] node not found. Install Node.js 18+ from nodejs.org
    pause & exit /b 1
)
echo [OK] Node found

REM ── Backend venv
echo.
echo [1/3] Setting up Python backend...
cd /d "%BACKEND%"

if not exist "venv\" (
    echo      Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo [OK] Backend ready

REM ── Frontend deps
echo.
echo [2/3] Setting up React frontend...
cd /d "%FRONTEND%"
if not exist "node_modules\" (
    echo      Installing npm packages (first run takes ~1 min)...
    npm install --legacy-peer-deps --silent
)
echo [OK] Frontend ready

REM ── Launch backend in new window
echo.
echo [3/3] Launching servers...
cd /d "%BACKEND%"
start "VitalSync Backend" cmd /k "call venv\Scripts\activate.bat && python app.py"

REM Wait for backend
timeout /t 3 /nobreak >nul

REM Launch frontend in new window
cd /d "%FRONTEND%"
start "VitalSync Frontend" cmd /k "npm run dev"

REM Open browser
timeout /t 4 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo  Backend  : http://localhost:5000
echo  Frontend : http://localhost:3000
echo.
echo  Close the two server windows to stop.
echo.
pause
