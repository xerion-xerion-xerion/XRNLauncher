param(
  [int]$IdLauncher = 0,
  [string]$Zip = '',
  [string]$Dossier = '',
  [string]$Exe = ''
)

#  Applique une mise a jour du launcher.
#
#  Deux pieges ecrits ici apres les echecs rencontres :
#
#  1. Le launcher se cache dans le tray quand on ferme sa fenetre : ses
#     fichiers restent alors verrouilles et le remplacement echoue en
#     silence. On attend sa fermeture, et si le processus de rendu (un
#     fils) tient encore le dossier, on arrete tout l arbre : c'est lui
#     qui bloque l ecriture.
#
#  2. Chaque etape est notee dans un journal : une mise a jour qui ne
#     marche pas doit pouvoir se diagnostiquer sans console a ouvrir.

$ErrorActionPreference = 'Stop'

$journal = Join-Path $env:APPDATA 'XRNLauncher\logs\maj.log'
try {
  New-Item -ItemType Directory -Path (Split-Path -Parent $journal) -Force | Out-Null
} catch { }
function Ecrire($msg) {
  try {
    Add-Content -LiteralPath $journal -Value ((Get-Date).ToString('HH:mm:ss') + ' ' + $msg)
  } catch { }
}

Ecrire ('demarrage, zip=' + $Zip)

if ($IdLauncher -gt 0) {
  $limite = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $limite) {
    if (-not (Get-Process -Id $IdLauncher -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 300
  }
  if (Get-Process -Id $IdLauncher -ErrorAction SilentlyContinue) {
    Ecrire 'le launcher est toujours vivant, arret de tout son arbre'
    & taskkill.exe /PID $IdLauncher /T /F 2>&1 | Out-Null
    Start-Sleep -Milliseconds 1200
  } else {
    Ecrire 'le launcher a quitte, on continue'
  }
}

#  Filet de securite : le launcher NW.js lance plusieurs processus
#  (le rendu est un fils). Si l un d eux survit, il garde le fichier
#  executable ouvert et le remplacement echoue. On ferme donc tous les
#  processusvenes de ce meme executable.
if ($Exe) {
  $restants = @()
  try {
    $restants = Get-Process -ErrorAction SilentlyContinue |
      Where-Object { $_.Path -eq $Exe -and $_.Id -ne $PID }
  } catch { $restants = @() }
  if ($restants.Count) {
    Ecrire ('processus restants a fermer : ' + (($restants | ForEach-Object { $_.Id }) -join ', '))
    foreach ($p in $restants) {
      try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
    Start-Sleep -Milliseconds 700
  }
}

if (-not $Zip -or -not (Test-Path -LiteralPath $Zip)) { Ecrire 'archive introuvable, abandon'; exit 1 }
if (-not $Dossier) { Ecrire 'dossier cible absent, abandon'; exit 1 }

$t = Join-Path $env:TEMP ('xrn-maj-' + [guid]::NewGuid().ToString('N'))
try {
  Ecrire 'decompression'
  Expand-Archive -LiteralPath $Zip -DestinationPath $t -Force

  $racine = Get-ChildItem -LiteralPath $t -Directory | Select-Object -First 1
  if (-not $racine) { $racine = Get-Item -LiteralPath $t }

  $echecs = @()
  foreach ($item in (Get-ChildItem -LiteralPath $racine.FullName -Force)) {
    $cible = Join-Path $Dossier $item.Name
    if (Test-Path -LiteralPath $cible) {
      Remove-Item -LiteralPath $cible -Recurse -Force -ErrorAction SilentlyContinue
    }
    try {
      Move-Item -LiteralPath $item.FullName -Destination $cible -Force -ErrorAction Stop
    } catch {
      $echecs += $item.Name
      Ecrire ('remplacement impossible : ' + $item.Name)
    }
  }
  Ecrire ('remplacements termines, echecs=' + $echecs.Count)

  if ($Exe -and (Test-Path -LiteralPath $Exe)) {
    Ecrire ('relancement de ' + $Exe)
    Start-Process -FilePath $Exe
  } else {
    Ecrire 'executable introuvable, pas de relancement'
  }
  if ($echecs.Count) {
    Set-Content -LiteralPath (Join-Path $env:TEMP 'xrn-maj-echecs.log') -Value ($echecs -join ', ')
  }
} catch {
  Ecrire ('erreur : ' + $_.Exception.Message)
} finally {
  Remove-Item -LiteralPath $t -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Zip -Force -ErrorAction SilentlyContinue
  Ecrire 'fin'
}
