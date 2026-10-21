#Requires -Version 5.1
<#
    Produit le manifeste d'une installation a partir d'un dossier.

    Utile quand l'installation de reference est une archive deja
    publiee : on la decompresse, on genere son manifeste, et le build
    suivant sait alors exactement ce que contient cette version. Le
    patch qui en decoule s'applique a cette installation-la, au lieu
    de forcer le retelechargement de l'archive complete.

    Exemple :
      .\manifeste-etape.ps1 -Dossier C:\...\extrait -Version 4.3.6 -Out dist\XRNLauncher-manifest.json
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Dossier,
    [string]$Version = '',
    [string]$Runtime = '',
    [string]$Out = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'manifeste.ps1')

if (-not (Test-Path -LiteralPath $Dossier)) { throw "Dossier introuvable : $Dossier" }

#  Si le dossier contient un unique sous-dossier (archive decompressee),
#  c'est celui-la qui fait foi.
$racine = Get-Item -LiteralPath $Dossier
$sous = @(Get-ChildItem -LiteralPath $Dossier -Directory)
if ($sous.Count -eq 1) { $racine = $sous[0] }

if (-not $Version) {
    try {
        $p = Get-Content -LiteralPath (Join-Path $racine.FullName 'package.json') -Raw | ConvertFrom-Json
        if ($p.version) { $Version = [string]$p.version }
    } catch { }
}

$manifeste = Get-ManifesteApp -StageDir $racine.FullName -Version $Version -Runtime $Runtime

if (-not $Out) { $Out = Join-Path (Split-Path -Parent $PSScriptRoot) 'dist\XRNLauncher-manifest.json' }
$json = $manifeste | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText($Out, $json, (New-Object Text.UTF8Encoding $false))

Write-Host ("  Manifeste genere : {0}  (v{1}, runtime {2}, {3} fichiers)" -f $Out, $Version, $manifeste.runtime, $manifeste.fichiers.Count) -ForegroundColor Green
