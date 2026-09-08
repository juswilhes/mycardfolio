@echo off
REM mycardfolio starten: Backend (Port 3001) + Frontend (Port 5173).
REM %~dp0 = Ordner dieser Datei.
cd /d "%~dp0"

REM Backend ueber run-backend.bat (mit Auto-Neustart bei Absturz).
start "mycardfolio Backend"  /min cmd /S /k "%~dp0backend\run-backend.bat"
start "mycardfolio Frontend" /min cmd /S /k "cd /d "%~dp0frontend" && npm run dev"

REM Auf das Backend warten (max ~40s), dann Browser oeffnen.
echo Warte auf das Backend...
for /l %%i in (1,1,40) do (
  curl -s -o nul http://localhost:3001/api/collection && goto ready
  ping -n 2 127.0.0.1 >nul
)
:ready
start "" http://localhost:5173