@echo off
REM ==========================================================================
REM  XRNLauncher - Menu de construction (aucune installation requise)
REM  Clic droit > Executer en tant qu'administrateur si le blocage SmartScreen
REM  apparait (le runtime est telecharge depuis nwjs.io).
REM ==========================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
title XRNLauncher - Build

:MENU
cls
echo.
echo   ============================================================
echo     X R N   L A U N C H E R
echo     Application Windows portable
echo   ============================================================
echo.
echo   [1] Construire et lancer l'application
echo   [2] Construire l'exe + le zip de distribution
echo   [3] Tout reconstruire depuis zero (nettoyage + runtime)
echo   [4] Ouvrir le dossier dist
echo   [5] Quitter
echo.
set /p CHOIX=  Choix : 

if "%CHOIX%"=="1" goto RUN
if "%CHOIX%"=="2" goto ZIP
if "%CHOIX%"=="3" goto CLEAN
if "%CHOIX%"=="4" goto DIST
if "%CHOIX%"=="5" goto END
goto MENU

:RUN
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -Run
echo.
pause
goto END

:ZIP
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1"
echo.
pause
goto END

:CLEAN
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -Clean
echo.
pause
goto END

:DIST
start "" "%~dp0dist"
goto END

:END
endlocal
