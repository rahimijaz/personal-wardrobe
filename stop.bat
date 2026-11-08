@echo off
title Stop Personal Wardrobe Services
cd /d "%~dp0"

echo Stopping Personal Wardrobe services on ports 3000 and 8188...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-NetTCPConnection -LocalPort 3000,8188 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host '[OK] Ports 3000 and 8188 released.' -ForegroundColor Green"

echo.
echo All services have been stopped.
ping -n 3 127.0.0.1 >nul
