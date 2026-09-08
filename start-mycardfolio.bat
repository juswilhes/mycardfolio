@echo off
REM mycardfolio starten: Backend (Port 3001) + Frontend (Port 5173).
REM %~dp0 = Ordner dieser Datei.

cd /d "%~dp0"

REM Backend mit "npm start" (ohne --watch): node --watch + better-sqlite3
REM stuerzt beim automatischen Neustart nativ ab.
start "mycardfolio Backend"  /min cmd /S /k "cd /d "%~dp0backend" && npm start"
start "mycardfolio Frontend" /min cmd /S /k "cd /d "%~dp0frontend" && npm run dev"

REM ~15 s warten, dann Browser oeffnen
ping -n 16 127.0.0.1 >nul
start "" http://localhost:5173
