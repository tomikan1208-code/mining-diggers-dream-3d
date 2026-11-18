@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\.bin\vite.cmd" (
  call npm ci
  if errorlevel 1 goto failed
)
call npm run build
if errorlevel 1 goto failed
node server/index.js --open
if errorlevel 1 goto failed
exit /b 0
:failed
pause
exit /b 1
