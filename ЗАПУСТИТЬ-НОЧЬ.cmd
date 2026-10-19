@echo off
chcp 65001 >nul
title UniTest Night Runner
cd /d "%~dp0"

if exist night.done del /q night.done

set /a RESTARTS=0
:loop
set /a RESTARTS+=1
if %RESTARTS% gtr 20 goto end
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0night-watchdog.ps1" %*
if exist night.done goto end

echo.
echo Watchdog exited unexpectedly. Restarting in 30 seconds...
timeout /t 30 /nobreak >nul
goto loop

:end
echo.
echo ============================================================
echo   Night session finished.
echo   See NOCHNOY-OTCHET.md, screenshots\task*, logs\
echo ============================================================
pause
