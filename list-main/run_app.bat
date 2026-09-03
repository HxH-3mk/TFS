@echo off
chcp 65001 > nul
title منصة المواد التعليمية
echo ===================================================
echo     🚀 جاري تشغيل منصة المواد التعليمية...
echo ===================================================

cd /d "%~dp0"

:: إذا كان Node.js متوفراً، نشغل خادماً محلياً خفيفاً لتجنب قيود CORS في المتصفح
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] تشغيل خادم محلي عبر Node.js...
    start "" http://localhost:8080/index.html
    node -e "const http = require('http'); const fs = require('fs'); const path = require('path'); const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }; http.createServer((req, res) => { let reqPath = decodeURI(req.url.split('?')[0]); if (reqPath === '/') reqPath = '/index.html'; const filePath = path.join(__dirname, reqPath); if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not Found'); } const ext = path.extname(filePath).toLowerCase(); res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' }); fs.createReadStream(filePath).pipe(res); }).listen(8080, () => console.log('الموقع يعمل الآن على: http://localhost:8080'));"
    exit /b
)

:: إذا لم يكن Node.js متوفراً، نفتح الملف مباشرة في المتصفح الافتراضي
echo فتح الموقع في المتصفح...
start "" "%~dp0index.html"
exit /b
