#Requires -Version 5.1
<#
    Genere le manifeste d'une etape (un dossier d'installation).

    Le manifeste dit ce que contient reellement l'application : la
    version, la version du runtime, la liste des fichiers avec leur
    taille et leur empreinte SHA-256.

    Deux usages :

      - le build l'ecrit dans l'application (tools\manifest.json) et
        dans le dossier dist, ou il sert de reference a la version
        suivante ;
      - on peut le produire a partir d'une archive deja publiee, pour
        savoir exactement ce que contient une installation existante.

    Les fichiers de l'application sont listes explicitement : le runtime
    (300 Mo) n'en fait pas partie, et on ne veut pas le hacher a chaque
    build.
#>

function Get-FichiersApp {
    param([string]$StageDir)

    $fichiersApp = @('index.html','style.css','ui.js','main.js','notification.json','package.json')
    $dossiersApp = @('lib','assets','tools','mods-integres')

    $liste = @()
    foreach ($f in $fichiersApp) {
        $abs = Join-Path $StageDir $f
        if (-not (Test-Path -LiteralPath $abs)) { continue }
        $liste += [ordered]@{
            chemin = $f
            taille = (Get-Item -LiteralPath $abs).Length
            sha256 = (Get-FileHash -LiteralPath $abs -Algorithm SHA256).Hash.ToLower()
        }
    }
    foreach ($d in $dossiersApp) {
        $abs = Join-Path $StageDir $d
        if (-not (Test-Path -LiteralPath $abs)) { continue }
        foreach ($fichier in (Get-ChildItem -LiteralPath $abs -Recurse -File)) {
            #  Le manifeste local n'est pas dans sa propre liste : il
            #  change a chaque build, et il se contredirait.
            if ($fichier.Name -eq 'manifest.json' -and $fichier.DirectoryName -eq $abs) { continue }
            $rel = $d + '/' + ($fichier.FullName.Substring($abs.Length + 1) -replace '\\','/')
            $liste += [ordered]@{
                chemin = $rel
                taille = $fichier.Length
                sha256 = (Get-FileHash -LiteralPath $fichier.FullName -Algorithm SHA256).Hash.ToLower()
            }
        }
    }
    return $liste
}

<#  Version du runtime NW.js : elle est dans les ressources de nw.dll. #>
function Get-VersionRuntime {
    param([string]$StageDir)
    $dll = Join-Path $StageDir 'nw.dll'
    if (-not (Test-Path -LiteralPath $dll)) { return '' }
    try {
        $v = (Get-Item -LiteralPath $dll).VersionInfo.FileVersion
        if ($v) { return ($v -split '\s+')[0] }
    } catch { }
    return ''
}

<#  Le manifeste complet d'une etape. #>
function Get-ManifesteApp {
    param(
        [string]$StageDir,
        [string]$Version = '',
        [string]$Runtime = ''
    )
    if (-not $Runtime) { $Runtime = Get-VersionRuntime -StageDir $StageDir }
    $exe = Join-Path $StageDir 'XRNLauncher.exe'
    $manifeste = [ordered]@{
        version    = $Version
        runtime    = $Runtime
        exe        = $null
        fichiers   = @(Get-FichiersApp -StageDir $StageDir)
    }
    if (Test-Path -LiteralPath $exe) {
        $manifeste.exe = [ordered]@{
            taille = (Get-Item -LiteralPath $exe).Length
            sha256 = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLower()
        }
    }
    return $manifeste
}
