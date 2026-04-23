@echo off
REM Double-click to start the home relay on Windows.
REM
REM First time only:
REM   1. Install Node.js from https://nodejs.org (LTS). Reboot after.
REM   2. Open PowerShell in this folder and run:
REM         npm install
REM         npm run install-browsers
REM   3. Copy .env.example to .env and edit it (VPS URL + SESSION_SECRET).
REM
REM After that, double-clicking this file is enough.

cd /d "%~dp0"

if not exist .env (
  echo .env nie istnieje. Skopiuj .env.example do .env i uzupelnij VPS_URL + SESSION_SECRET.
  pause
  exit /b 1
)
if not exist node_modules (
  echo node_modules nie istnieje. Odpal najpierw: npm install
  pause
  exit /b 1
)

node relay.mjs
pause
