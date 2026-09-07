@echo off
REM mycardfolio starten: Backend (Port 3001) + Frontend (Port 5173).
REM %~dp0 = Ordner dieser Datei (mit abschliessendem Backslash).

cd /d "%~dp0"

start "mycardfolio Backend"  /min cmd /S /k "cd /d "%~dp0backend" && npm run dev"
start "mycardfolio Frontend" /min cmd /S /k "cd /d "%~dp0frontend" && npm run dev"

REM ~15 s warten (ping statt timeout: braucht keine Konsoleneingabe),
REM dann Browser oeffnen
ping -n 16 127.0.0.1 >nul
start "" http://localhost:5173
