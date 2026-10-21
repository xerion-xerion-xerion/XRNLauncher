#Requires -Version 5.1
<#
    Compile le detecteur de musique (XrnMedia.exe).

    Le programme interroge l'API Windows "System Media Transport
    Controls", qui vit dans le WinRT. Compiler contre le WinRT demande
    les contrats Windows (les .winmd) et System.Runtime.WindowsRuntime.
    Aucun de ces fichiers n'est livre avec Windows : les contrats sont
    telecharges une fois, puis compiles dans le dossier de cache.

    Ce script est reproductible : il retelecharge les contrats si le
    cache a disparu, et il recompile l'executable a partir de la
    source qui se trouve a cote de lui.

    Exemple :
      .\compiler-xrnmedia.ps1
#>
[CmdletBinding()]
param(
    [string]$Cache = (Join-Path $env:TEMP 'xrnmedia-build'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $Root 'tools\XrnMedia.cs'
$Sortie = Join-Path $Root 'tools\XrnMedia.exe'

# --- contrats Windows ---------------------------------------------------
#  Le paquet NuGet contient les .winmd. Il est telecharge une fois.
$paquet = Join-Path $Cache 'contracts.nupkg'
$refs = Join-Path $Cache 'ref\netstandard2.0'

if ($Force -or -not (Test-Path -LiteralPath $refs)) {
    Write-Host '  Telechargement des contrats Windows...' -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $Cache -Force | Out-Null
    $url = 'https://www.nuget.org/api/v2/package/Microsoft.Windows.SDK.Contracts/10.0.19041.1'
    & curl.exe -sS -L --fail --max-time 600 -o $paquet $url
    if ($LASTEXITCODE -ne 0) { throw 'Telechargement des contrats impossible.' }
    if (Test-Path -LiteralPath $Cache) {
        Get-ChildItem -LiteralPath $Cache -Directory | Where-Object { $_.Name -ne 'ref' } |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($paquet)
    try {
        foreach ($e in $zip.Entries) {
            if ($e.FullName -like 'ref/netstandard2.0/*' -and $e.Name -like '*.winmd') {
                $dest = Join-Path $Cache ($e.FullName -replace '/', '\')
                $dossier = Split-Path -Parent $dest
                if (-not (Test-Path -LiteralPath $dossier)) { New-Item -ItemType Directory -Path $dossier -Force | Out-Null }
                [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dest, $true)
            }
        }
    } finally { $zip.Dispose() }
}

#  Seuls quelques contrats sont utiles : le socle, les fondations et le
#  controle des medias. Les autres feraient perdre du temps a compiler.
$contrats = @(
    'Windows.WinMD',
    'Windows.Foundation.FoundationContract.winmd',
    'Windows.Foundation.UniversalApiContract.winmd',
    'Windows.Media.MediaControlContract.winmd'
)
$arguments = @()
foreach ($c in $contrats) {
    $p = Join-Path $refs $c
    if (-not (Test-Path -LiteralPath $p)) { throw "Contrat introuvable : $p" }
    $arguments += '/reference:' + $p
}

# --- System.Runtime.WindowsRuntime --------------------------------------
#  C'est lui qui sait transformer un objet WinRT en objet .NET.
$wr = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\System.Runtime.WindowsRuntime.dll'
if (-not (Test-Path -LiteralPath $wr)) {
    $wr = Join-Path $env:SystemRoot 'Microsoft.NET\Framework\v4.0.30319\System.Runtime.WindowsRuntime.dll'
}
if (-not (Test-Path -LiteralPath $wr)) { throw 'System.Runtime.WindowsRuntime.dll introuvable.' }
$arguments += '/reference:' + $wr

# --- System.Runtime ------------------------------------------------------
#  Les contrats WinRT sont decores d attributs venus de netstandard :
#  sans cette facade, la compilation echoue sur un "System.Runtime
#  introuvable". Elle est dans la GAC de Windows.
$facades = @(
    (Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\Facades\System.Runtime.dll'),
    (Join-Path $env:SystemRoot 'Microsoft.NET\Framework\v4.0.30319\Facades\System.Runtime.dll')
)
$runtime = $null
foreach ($f in $facades) { if (Test-Path -LiteralPath $f) { $runtime = $f; break } }
if (-not $runtime) {
    $gac = Get-ChildItem (Join-Path $env:SystemRoot 'Microsoft.NET\assembly\GAC_MSIL\System.Runtime') `
        -Recurse -Filter 'System.Runtime.dll' -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($gac) { $runtime = $gac.FullName }
}
if (-not $runtime) { throw 'System.Runtime.dll introuvable.' }
$arguments += '/reference:' + $runtime

# --- compilation ---------------------------------------------------------
$csc = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $csc)) {
    $csc = Join-Path $env:SystemRoot 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}

$temp = Join-Path $Cache 'XrnMedia.exe'
& $csc /nologo /target:exe /platform:anycpu /optimize+ /out:$temp $arguments /reference:System.Drawing.dll $Source
if ($LASTEXITCODE -ne 0) { throw 'La compilation a echoue.' }

Copy-Item -LiteralPath $temp -Destination $Sortie -Force
Write-Host ("  Detecteur compile : {0} ({1} octets)" -f $Sortie, (Get-Item $Sortie).Length) -ForegroundColor Green
