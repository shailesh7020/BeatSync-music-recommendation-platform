@echo off
title BeatSync - AI Music Platform
cd /d "%~dp0"
python start.py %*
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo An error occurred while starting BeatSync.
    pause
)
