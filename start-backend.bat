@echo off
title SmartHR - Backend
color 0B
echo ========================================
echo   SmartHR - Backend (NestJS)
echo   http://localhost:3000/api
echo   Swagger: http://localhost:3000/api/docs
echo ========================================
echo.
echo Demarrage de la base de donnees...
docker start smarthr-postgres
echo.
echo Demarrage du backend...
cd /d I:\Logiciel_RH_Payroll\Backend
npm run start:dev
pause
