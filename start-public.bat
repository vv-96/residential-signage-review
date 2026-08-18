@echo off
chcp 65001 >nul 2>&1
title mvp-web - Start Server + Public Tunnel
cd /d "%~dp0"

echo ================================================
if exist "dist\index.html" (
  echo   Build exists. Skipping build.
) else (
  echo   [0/3] Building (dist missing) ...
  echo ================================================
  call npm run build
  if errorlevel 1 (
    echo.
    echo   BUILD FAILED. Check errors above, then run again.
    pause
    exit /b 1
  )
)

echo ================================================
echo   [1/3] Starting local server (port 3000) ...
echo ================================================
start "mvp-web-server" cmd /k "npm run start"

timeout /t 6 /nobreak >nul

echo ================================================
echo   [2/3] Starting cpolar public tunnel ...
echo   A new window will open. Keep it OPEN.
echo   Copy the public URL (xxxx.r7.cpolar.cn) from it.
echo ================================================
start "cpolar-tunnel" cmd /k ""C:\Program Files\cpolar\cpolar.exe" http 3000 -region cn"

timeout /t 6 /nobreak >nul
echo.
echo   Done.
echo   Local URL:  http://localhost:3000
echo   Public URL: see the "cpolar-tunnel" window.
echo.
pause
