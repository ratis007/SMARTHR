@echo off
title SmartHR - Frontend
color 0E
echo ========================================
echo   SmartHR - Frontend (React + Vite)
echo   http://localhost:5173
echo ========================================
echo.
cd /d "%~dp0Frontend"
npm run dev -- --host 0.0.0.0
pause
