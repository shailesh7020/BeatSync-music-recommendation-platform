@echo off
title Stop BeatSync
echo Stopping any running BeatSync servers on ports 8000 and 5173...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /f /pid %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [✓] BeatSync servers stopped successfully!
timeout /t 2 >nul
