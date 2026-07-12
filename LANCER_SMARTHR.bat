@echo off
title SmartHR - Lancement Complet
color 0A
echo.
echo  ==========================================
echo   SmartHR - Lancement Backend + Frontend
echo  ==========================================
echo.

REM Verifier si le projet existe
if not exist "%~dp0Backend" (
    echo ERREUR: Le dossier Backend est introuvable dans %~dp0
    pause
    exit /b 1
)

echo [1/3] Demarrage de la base de donnees PostgreSQL...
docker start smarthr-postgres
timeout /t 3 /nobreak >nul
echo.

echo [2/3] Lancement du Backend (NestJS)...
start "SmartHR Backend" cmd /k "cd /d "%~dp0Backend" && color 0B && echo Backend demarre sur http://localhost:3000/api && echo Swagger: http://localhost:3000/api/docs && echo. && npm run start:dev"
echo Attente demarrage backend...
timeout /t 8 /nobreak >nul
echo.

echo [3/3] Lancement du Frontend (React + Vite)...
start "SmartHR Frontend" cmd /k "cd /d "%~dp0Frontend" && color 0E && echo Frontend demarre sur http://localhost:5173 && echo. && npm run dev -- --host 0.0.0.0"
echo.

echo ==========================================
echo  SmartHR est en cours de demarrage !
echo.
echo  Backend:  http://localhost:3000/api
echo  Frontend: http://localhost:5174
echo  Swagger:  http://localhost:3000/api/docs
echo.
echo  Deux fenetres sont ouvertes.
echo  Fermez-les pour arreter l'application.
echo ==========================================
echo.
pause
