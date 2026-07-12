@echo off
title SmartHR - Frontend
color 0E
echo  SmartHR Frontend - http://localhost:5173
echo.
cd /d "%~dp0Frontend"
npm run dev -- --host 0.0.0.0
pause
