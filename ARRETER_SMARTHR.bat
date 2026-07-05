@echo off
setlocal
title SmartHR - Arret local
color 0C

cd /d "%~dp0"

echo.
echo  ==========================================
echo   SmartHR - Arret local
echo  ==========================================
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo ERREUR: Docker n'est pas disponible.
  pause
  exit /b 1
)

docker compose -f docker-compose.local.yml down
if errorlevel 1 (
  echo.
  echo ERREUR: Impossible d'arreter les services.
  pause
  exit /b 1
)

echo.
echo SmartHR est arrete. Les donnees PostgreSQL sont conservees.
echo Pour supprimer les donnees, utilisez Docker Desktop et supprimez le volume smarthr_postgres_data.
echo.
pause
