param(
  [string]$Version = '',
  [switch]$SansVersion
)

#  Deploie la version construite dans l installation locale
#  (%LOCALAPPDATA%\XRNLauncher).
#
#  IMPORTANT : ce script ne doit jamais remettre la version a la
#  main. J avais fait cela pour garder une mise a jour a tester, et
#  ca a photographie l installation en 4.3.0 pendant des versions :
#  le joueur voyait une mise a jour disponible alors qu elle etait
#  deja installee. La version du deploi est toujours celle du build.

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root 'dist'
$App = Join-Path $env:LOCALAPPDATA 'XRNLauncher'

if (-not $Version) {
  $Version = (Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
}
$Archive = Join-Path $Dist "XRNLauncher-v$Version-win-x64.zip"
if (-not (Test-Path -LiteralPath $Archive)) {
  throw "Archive introuvable : $Archive (lance build.ps1 d abord)"
}

Write-Host "  Deploiement de la v$Version dans $App" -ForegroundColor Cyan

Get-Process -Name 'XRNLauncher' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3

if (-not (Test-Path -LiteralPath $App)) {
  New-Item -ItemType Directory -Path $App -Force | Out-Null
}

$tmp = Join-Path $env:TEMP ("xrn-deploy-" + [guid]::NewGuid().ToString('N'))
try {
  Expand-Archive -LiteralPath $Archive -DestinationPath $tmp -Force
  $racine = Get-ChildItem -LiteralPath $tmp -Directory | Select-Object -First 1
  if (-not $racine) { $racine = Get-Item -LiteralPath $tmp }
  Get-ChildItem -LiteralPath $racine.FullName -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $App -Recurse -Force
  }
} finally {
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

#  La version affichee est celle du build, jamais une autre.
$package = Join-Path $App 'package.json'
$p = Get-Content $package -Raw | ConvertFrom-Json
$p.version = $Version
[IO.File]::WriteAllText($package, ($p | ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding $false))

Write-Host "  Version installee : $Version" -ForegroundColor Green
Write-Host "  (aucune autre version ne doit etre ecrite ici)" -ForegroundColor DarkGray
