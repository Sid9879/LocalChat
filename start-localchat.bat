@echo off
echo ========================================================
echo        Starting LocalChat Private LAN Platform
echo ========================================================
echo.
echo Starting LocalChat Backend Server on port 5000...
start "LocalChat Server" cmd /k "cd /d %~dp0server && npm run dev"

timeout /t 3 >nul

echo Starting LocalChat Frontend Client on port 5173...
start "LocalChat Client" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo ========================================================
echo Both Backend and Frontend services are launching!
echo.
echo Web UI:    http://localhost:5173  (or https://<Your-LAN-IP>:5173)
echo Admin:     admin / admin123
echo ========================================================
pause
