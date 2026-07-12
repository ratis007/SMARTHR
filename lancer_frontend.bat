@echo off
setlocal
cd /d "%~dp0Frontend"

echo ========================================
echo   Installation et lancement du Frontend
echo ========================================
echo.

echo [1/2] Installation des dependances...
npm install
if errorlevel 1 (
    echo.
    echo ERREUR: npm install a echoue.
    pause
    exit /b 1
)

echo.
echo [2/2] Demarrage du frontend...
start "SmartHR Frontend" cmd /k "cd /d "%~dp0Frontend" && npm run dev -- --host 0.0.0.0"

echo.
echo Frontend demarre sur http://localhost:5173
pause
