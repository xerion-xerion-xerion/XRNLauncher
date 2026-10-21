@echo off
setlocal enabledelayedexpansion
title Installation de XRNLauncher

rem  Installeur de XRNLauncher.
rem
rem  Ce script ne contient aucune application : il telecharge la
rem  derniere version depuis GitHub, la pose dans le dossier de
rem  l'utilisateur, cree un raccourci sur le Bureau et lance le
rem  launcher.
rem
rem  Le dossier d'installation ne porte pas de numero de version :
rem  les mises a jour suivantes se font par dessus, en place.

set "REPO=https://github.com/xerion-xerion-xerion/XRNLauncher"
set "ASSET=XRNLauncher-win-x64.zip"
set "APP=%LOCALAPPDATA%\XRNLauncher"
set "TMP=%TEMP%\xrn-installeur"

echo.
echo   ============================================================
echo     X R N   L A U N C H E R   -   I N S T A L L A T I O N
echo   ============================================================
echo.
echo   Dossier d'installation : %APP%
echo.

where curl.exe >nul 2>&1
if errorlevel 1 (
  echo   [ERREUR] Windows 10 ou plus recent est necessaire.
  echo            curl.exe est introuvable sur ce systeme.
  echo.
  pause
  exit /b 1
)

if exist "%TMP%" rmdir /s /q "%TMP%"
mkdir "%TMP%" >nul 2>&1

echo   [1/3] Telechargement de la derniere version...
curl.exe -L --fail --retry 3 --progress-bar -o "%TMP%\app.zip" "%REPO%/releases/latest/download/%ASSET%"
if errorlevel 1 (
  echo.
  echo   [ERREUR] Le telechargement a echoue. Verifiez la connexion.
  echo.
  pause
  exit /b 1
)

echo   [2/3] Installation des fichiers...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%TMP%\app.zip' -DestinationPath '%TMP%\extrait' -Force"
if errorlevel 1 goto :echec

set "SRC="
for /d %%D in ("%TMP%\extrait\*") do if not defined SRC set "SRC=%%D"
if not defined SRC goto :echec

if not exist "%APP%" mkdir "%APP%" >nul 2>&1
xcopy "%SRC%\*" "%APP%\" /E /I /Y /Q >nul
if errorlevel 1 goto :echec

echo   [3/3] Creation du raccourci sur le Bureau...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$bureau=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $bureau 'XRNLauncher.lnk')); $s.TargetPath='%APP%\XRNLauncher.exe'; $s.WorkingDirectory='%APP%'; $s.IconLocation='%APP%\XRNLauncher.exe,0'; $s.Description='XRNLauncher'; $s.Save()"
if errorlevel 1 goto :echec

rmdir /s /q "%TMP%" >nul 2>&1

echo.
echo   Installation terminee. Le launcher se lance.
echo.
rem  Le launcher est lance sans la console de l installeur : sinon il
rem  lui reste accroche, et la fenetre noire ne se ferme qu'a la
rem  fermeture du launcher.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%APP%\XRNLauncher.exe'"
exit /b 0

:echec
echo.
echo   [ERREUR] L installation a echoue. Le dossier de telechargement
echo            est conserve dans : %TMP%
echo.
pause
exit /b 1
