@echo off
setlocal
title SmartHR - Installation et lancement local
color 0A

cd /d "%~dp0"

echo.
echo  ==========================================
echo   SmartHR - Installation et lancement local
echo  ==========================================
echo.
echo  Ce lanceur utilise Docker Desktop.
echo  Premiere execution: telechargement/build, cela peut prendre quelques minutes.
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo ERREUR: Docker n'est pas installe ou n'est pas dans le PATH.
  echo Installez Docker Desktop puis relancez ce fichier.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo ERREUR: Docker Desktop n'est pas demarre.
  echo Ouvrez Docker Desktop, attendez qu'il soit pret, puis relancez ce fichier.
  pause
  exit /b 1
)

if not exist "Backend\.env" (
  if exist "Backend\.env.example" (
    copy "Backend\.env.example" "Backend\.env" >nul
  )
)

echo [0/3] Liberation des anciens conteneurs SmartHR si necessaire...
docker stop smarthr-backend smarthr-frontend smarthr-postgres >nul 2>nul

echo [1/3] Construction et demarrage des services...
docker compose -f docker-compose.local.yml up -d --build
if errorlevel 1 (
  echo.
  echo ERREUR: Le demarrage Docker a echoue.
  echo Consultez les messages ci-dessus.
  pause
  exit /b 1
)

echo.
echo [2/3] Verification du backend...
for /l %%i in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/docs -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto backend_ok
  timeout /t 2 /nobreak >nul
)
echo ATTENTION: Le backend prend plus de temps que prevu.
goto after_backend

:backend_ok
echo Backend pret.

:after_backend
echo.
echo [3/3] Verification du frontend...
for /l %%i in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 goto frontend_ok
  timeout /t 2 /nobreak >nul
)
echo ATTENTION: Le frontend prend plus de temps que prevu.
goto done

:frontend_ok
echo Frontend pret.

:done
echo.
echo  ==========================================
echo   SmartHR est lance.
echo.
echo   Frontend : http://localhost:5173
echo   API      : http://localhost:3000/api
echo   Swagger  : http://localhost:3000/api/docs
echo.
echo   Connexion:
echo   admin@smarthr.com
echo   SmartHR@2026
echo.
echo   Pour arreter: double-cliquez ARRETER_SMARTHR.bat
echo  ==========================================
echo.

start "" "http://localhost:5173"
pause
