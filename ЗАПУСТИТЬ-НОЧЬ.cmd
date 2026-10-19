@echo off
chcp 65001 >nul
title UniTest Night Runner
cd /d "%~dp0"

echo.
echo ============================================================
echo   UniTest - night runner
echo   One task -^> checks -^> screenshots -^> commit
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0night-run.ps1" %*

echo.
echo ============================================================
echo   Runner finished. See NOCHNOY-OTCHET.md / night report.
echo ============================================================
pause
