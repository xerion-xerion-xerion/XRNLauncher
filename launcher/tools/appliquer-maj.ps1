param(
  [int]$IdLauncher = 0,
  [string]$Mode = 'complet',
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
#     qui bloque l'ecriture.
#
#  2. Chaque etape est notee dans un journal : une mise a jour qui ne
#     marche pas doit pouvoir se diagnostiquer sans console a ouvrir.
#
#  Deux modes :
#
#  - "complet" : l'archive contient toute l'application (runtime
#    compris). On remplace le contenu du dossier d'installation.
#  - "patch" : l'archive ne contient que les fichiers modifies. On
#    ecrase ces fichiers la, et on supprime ceux qui ont disparu. Le
#    runtime, qui pese 400 Mo, n'est donc pas retelecharge.

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

Ecrire ('demarrage, mode=' + $Mode + ', zip=' + $Zip)

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
#  processusenames de ce meme executable.
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

  #  Le dossier racine : soit un sous-dossier nomme, soit le dossier
  #  de decompression lui-meme.
  $racine = $null
  $sousDossiers = @(Get-ChildItem -LiteralPath $t -Directory)
  if ($sousDossiers.Count -eq 1) { $racine = $sousDossiers[0] }
  elseif ($sousDossiers.Count -gt 1) {
    $nomme = $sousDossiers | Where-Object { $_.Name -eq 'patch' } | Select-Object -First 1
    $racine = if ($nomme) { $nomme } else { $sousDossiers[0] }
  } else {
    $racine = Get-Item -LiteralPath $t
  }
  Ecrire ('racine de l archive : ' + $racine.FullName)

  $echecs = @()

  if ($Mode -eq 'patch') {
    #  Patch : on ecrase les fichiers livres, on ne touche pas au reste.
    $fichiers = @(Get-ChildItem -LiteralPath $racine.FullName -Recurse -File)
    $ecrits = 0
    foreach ($f in $fichiers) {
      $rel = $f.FullName.Substring($racine.FullName.Length).TrimStart('\', '/')
      if ($rel -eq '_supprimes.txt') { continue }
      $cible = Join-Path $Dossier $rel
      try {
        $dossierCible = Split-Path -Parent $cible
        if (-not (Test-Path -LiteralPath $dossierCible)) {
          New-Item -ItemType Directory -Path $dossierCible -Force | Out-Null
        }
        Copy-Item -LiteralPath $f.FullName -Destination $cible -Force -ErrorAction Stop
        $ecrits++
      } catch {
        $echecs += $rel
        Ecrire ('remplacement impossible : ' + $rel)
      }
    }
    Ecrire ('patch applique, fichiers ecrits=' + $ecrits + ', echecs=' + $echecs.Count)

    #  Les fichiers qui ont disparu de la version nouvelle doivent
    #  partir aussi, sinon ils trainaient d'une version a l'autre.
    $listeSupprimes = Join-Path $racine.FullName '_supprimes.txt'
    if (Test-Path -LiteralPath $listeSupprimes) {
      foreach ($ligne in (Get-Content -LiteralPath $listeSupprimes)) {
        $rel = $ligne.Trim()
        if (-not $rel) { continue }
        $cible = Join-Path $Dossier ($rel -replace '/', '\')
        if (Test-Path -LiteralPath $cible) {
          try {
            Remove-Item -LiteralPath $cible -Force -ErrorAction Stop
            Ecrire ('fichier supprime : ' + $rel)
          } catch {
            $echecs += $rel
            Ecrire ('suppression impossible : ' + $rel)
          }
        }
      }
    }
  } else {
    #  Archive complete : on remplace le contenu du dossier.
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
  }

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
