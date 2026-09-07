@echo off
REM MyCardfolio starten: Backend (Port 3001) + Frontend (Port 5173)
cd /d "%~dp0"

start "MyCardfolio Backend"  cmd /k "cd /d "%~dp0backend"  && npm run dev"
start "MyCardfolio Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

REM kurz warten, bis Vite oben ist, dann Browser oeffnen
timeout /t 6 /nobreak >nul
start "" http://localhost:5173
