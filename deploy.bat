@echo off
chcp 65001 >nul
echo.
echo ========================================
echo   سكريبت نشر المشروع - AI CV Builder
echo ========================================
echo.

REM تشغيل سكريبت PowerShell
powershell -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*

pause
