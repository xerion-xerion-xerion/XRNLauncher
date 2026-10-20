#  Applique une mise a jour du launcher.

  Le launcher se termine, ce script attend sa fermeture, remplace les
  fichiers de l application par ceux de l archive, puis relance le
  launcher. Les donnees de l utilisateur (dossier AppData) ne sont
  pas touchees : elles sont a part.

  Lance par le launcher, jamais a la main.
param(
  [int]$PidLauncher = 0,
  [string]$Zip = '',
  [string]$Dossier = '',
  [string]$Exe = ''
)

$ErrorActionPreference = 'Stop'

#  On attend que le launcher ait rendu la main sur ses fichiers.
if ($PidLauncher -gt 0) {
  $limite = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $limite) {
    if (-not (Get-Process -Id $PidLauncher -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 400
  }
  Start-Sleep -Milliseconds 800
}

if (-not $Zip -or -not (Test-Path -LiteralPath $Zip)) { exit 1 }
if (-not $Dossier) { exit 1 }

$t = Join-Path $env:TEMP ('xrn-maj-' + [guid]::NewGuid().ToString('N'))
try {
  Expand-Archive -LiteralPath $Zip -DestinationPath $t -Force
  $racine = Get-ChildItem -LiteralPath $t -Directory | Select-Object -First 1
  if (-not $racine) { exit 1 }
  foreach ($item in (Get-ChildItem -LiteralPath $racine.FullName -Force)) {
    $cible = Join-Path $Dossier $item.Name
    if (Test-Path -LiteralPath $cible) {
      Remove-Item -LiteralPath $cible -Recurse -Force -ErrorAction SilentlyContinue
    }
    Move-Item -LiteralPath $item.FullName -Destination $cible -Force
  }
  if ($Exe -and (Test-Path -LiteralPath $Exe)) {
    Start-Process -FilePath $Exe
  }
} finally {
  Remove-Item -LiteralPath $t -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Zip -Force -ErrorAction SilentlyContinue
}
