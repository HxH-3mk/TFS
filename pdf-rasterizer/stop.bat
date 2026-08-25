@echo off
title Stop PDF Rasterizer Pro
echo Stopping PDF Rasterizer Server on port 5005...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5005" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [OK] Server stopped successfully.
ping 127.0.0.1 -n 2 >nul
