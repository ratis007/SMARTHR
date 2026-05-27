@echo off
title SmartHR - Demarrage
color 0A
echo.
echo  ==========================================
echo   SmartHR - Resolution chemins longs
echo  ==========================================
echo.
echo  Le projet sera copie dans C:\HR pour eviter
echo  les erreurs de chemins trop longs sur Windows.
echo.

set SOURCE=%~dp0
set DEST=C:\HR

echo Copie du projet vers %DEST%...
if not exist "%DEST%" mkdir "%DEST%"

xcopy "%SOURCE%Backend" "%DEST%\Backend\" /E /I /Y /Q
xcopy "%SOURCE%Frontend" "%DEST%\Frontend\" /E /I /Y /Q

echo.
echo Suppression des node_modules corrompus...
if exist "%DEST%\Backend\node_modules" rmdir /s /q "%DEST%\Backend\node_modules"
if exist "%DEST%\Frontend\node_modules" rmdir /s /q "%DEST%\Frontend\node_modules"

echo.
echo Installation Backend...
cd /d "%DEST%\Backend"
npm install
if errorlevel 1 ( echo ERREUR Backend & pause & exit /b 1 )

echo.
echo Installation Frontend...
cd /d "%DEST%\Frontend"
npm install
if errorlevel 1 ( echo ERREUR Frontend & pause & exit /b 1 )

echo.
echo ==========================================
echo  Installation terminee !
echo  Lancer maintenant :
echo  - start-backend.bat  (dans C:\HR)
echo  - start-frontend.bat (dans C:\HR)
echo ==========================================
pause
