@echo off
REM Startet das Backend und startet es neu, falls better-sqlite3 unter
REM Node 24 beim Start nativ abstuerzt (Exit-Code ungleich 0).
cd /d "%~dp0"
:loop
node src\server.js
if errorlevel 1 (
  echo.
  echo Backend hat sich unerwartet beendet - Neustart in 2 Sekunden...
  timeout /t 2 /nobreak >nul
  goto loop
)
echo Backend regulaer beendet.