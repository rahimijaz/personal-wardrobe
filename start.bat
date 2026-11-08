@echo off
title Personal Wardrobe - AI Virtual Try-On Studio
cd /d "%~dp0"

echo ========================================================
echo    Starting Personal Wardrobe ^& AI Try-On Studio...
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"

if %ERRORLEVEL% neq 0 (
    echo.
    echo Process exited with code %ERRORLEVEL%.
)
echo.
pause
