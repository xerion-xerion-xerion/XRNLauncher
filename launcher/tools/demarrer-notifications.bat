@echo off
REM ===================================================================
REM  Serveur de notifications du launcher.
REM
REM  A lancer une fois, et a laisser tourner. L application vient
REM  chercher le message a afficher, et le journal des installations
REM  s ecrit tout seul dans tools\registrations.log.
REM
REM  Pour arreter : fermer cette fenetre, ou Ctrl+C.
REM ===================================================================
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js est introuvable. Installe-le depuis https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo   Serveur de notifications : http://127.0.0.1:8788/notification.json
echo   Journal des installations : tools\registrations.log
echo   Pour arreter : Ctrl+C
echo.

node notification-server.js %1
