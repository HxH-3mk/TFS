@echo off
title PDF Rasterizer Pro
cd /d "%~dp0"

echo ========================================================
echo   Starting PDF Rasterizer Pro...
echo   Web Interface: http://127.0.0.1:5005
echo ========================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3 and try again.
    pause
    exit /b 1
)

start "" http://127.0.0.1:5005

python app.py
pause
