param(
  [int]$IdLauncher = 0,
  [string]$Zip = '',
  [string]$Dossier = '',
  [string]$Exe = ''
)

#  Applique une mise a jour du launcher.
#
#  Le launcher se cache dans le tray quand on ferme sa fenetre : ses
#  fichiers restent alors verrouilles, et le remplacement echoue en
#  silence. On attend donc sa fermeture, et s il est toujours vivant
#  on l arrete : les fichiers se liberent, et on peut ecrire.

$ErrorActionPreference = 'Stop'

if ($IdLauncher -gt 0) {
  $limite = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $limite) {
    if (-not (Get-Process -Id $IdLauncher -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 300
  }
  if (Get-Process -Id $IdLauncher -ErrorAction SilentlyContinue) {
    Stop-Process -Id $IdLauncher -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 900
  }
}

if (-not $Zip -or -not (Test-Path -LiteralPath $Zip)) { exit 1 }
if (-not $Dossier) { exit 1 }

$t = Join-Path $env:TEMP ('xrn-maj-' + [guid]::NewGuid().ToString('N'))
try {
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
    }
  }

  if ($Exe -and (Test-Path -LiteralPath $Exe)) {
    Start-Process -FilePath $Exe
  }
  if ($echecs.Count) {
    Set-Content -LiteralPath (Join-Path $env:TEMP 'xrn-maj-echecs.log') -Value ($echecs -join ', ')
  }
} finally {
  Remove-Item -LiteralPath $t -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Zip -Force -ErrorAction SilentlyContinue
}
