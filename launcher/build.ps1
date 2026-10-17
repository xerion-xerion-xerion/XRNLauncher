#Requires -Version 5.1
<#
.SYNOPSIS
    XRNLauncher - build d'une application Windows portable (.exe) a partir de NW.js.

.DESCRIPTION
    Ce script ne necessite NI Node.js, NI npm, NI Electron.
    Il telecharge le runtime NW.js (pre-compile) une seule fois, y injecte l'UI,
    renomme nw.exe en <AppName>.exe, puis produit un .zip de distribution.

.PARAMETER AppName
    Nom du .exe final (sans extension).

.PARAMETER NwjsVersion
    Version de NW.js a utiliser. Par defaut : derniere version stable trouvee automatiquement.

.PARAMETER Arch
    x64 (defaut) ou x86.

.PARAMETER Flavor
    normal (defaut, le plus leger) ou sdk (avec outils de developpement).

.PARAMETER SkipZip
    Ne pas generer l'archive .zip.

.PARAMETER Run
    Lance l'application apres le build.

.PARAMETER Clean
    Supprime build\ et dist\ avant de recommencer.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\build.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\build.ps1 -NwjsVersion 0.118.0 -Run
#>
[CmdletBinding()]
param(
    [string]$AppName     = 'XRNLauncher',
    [string]$Title       = 'XRNLauncher',
    [string]$NwjsVersion = '',
    [ValidateSet('x64','x86')][string]$Arch   = 'x64',
    [ValidateSet('normal','sdk')][string]$Flavor = 'normal',
    [switch]$SkipZip,
    [switch]$Run,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# ---------------------------------------------------------------------------
# Chemins
# ---------------------------------------------------------------------------
$Root      = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$BuildDir  = Join-Path $Root 'build'
$CacheDir  = Join-Path $BuildDir '_cache'
$RuntimeIn = Join-Path $CacheDir '_runtime_raw'
$DistDir   = Join-Path $Root 'dist'
$StageDir  = Join-Path $DistDir $AppName
$PayloadIn = Join-Path $Root 'index.html'

# ---------------------------------------------------------------------------
# Helpers d'affichage
# ---------------------------------------------------------------------------
function Step  ($m) { Write-Host "`n  $m" -ForegroundColor Cyan }
function Ok    ($m) { Write-Host "  [OK] $m" -ForegroundColor Green }
function Info  ($m) { Write-Host "       $m" -ForegroundColor DarkGray }
function Warn  ($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Die   ($m) { Write-Host "`n  [ERREUR] $m" -ForegroundColor Red; exit 1 }

function Banner {
    Write-Host ''
    Write-Host '   ============================================================' -ForegroundColor DarkCyan
    Write-Host '     X R N   L A U N C H E R   -   BUILD PORTABLE' -ForegroundColor White
    Write-Host '   ============================================================' -ForegroundColor DarkCyan
}

# ---------------------------------------------------------------------------
# Telechargement avec barre de progression
# ---------------------------------------------------------------------------
function Save-File {
    param([Parameter(Mandatory)][string]$Url, [Parameter(Mandatory)][string]$OutFile)

    Add-Type -AssemblyName System.Net.Http | Out-Null
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $true
    $client  = New-Object System.Net.Http.HttpClient($handler)
    $client.Timeout = [TimeSpan]::FromMinutes(30)

    try {
        $resp = $client.GetAsync($Url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        if (-not $resp.IsSuccessStatusCode) {
            throw "HTTP $([int]$resp.StatusCode) $(([string]$resp.ReasonPhrase)) - $Url"
        }
        $total = $resp.Content.Headers.ContentLength
        $src   = $resp.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
        $dst   = [System.IO.File]::Create($OutFile)

        $buf = New-Object byte[] (1MB)
        $sum = 0L
        $lastPct = -1
        while (($read = $src.Read($buf, 0, $buf.Length)) -gt 0) {
            $dst.Write($buf, 0, $read)
            $sum += $read
            if ($total -and $total -gt 0) {
                $pct = [int]($sum * 100 / $total)
                if ($pct -ge $lastPct + 3) {
                    Write-Host ("`r       {0,3}%  {1,6} / {2,6} Mo" -f $pct, [math]::Round($sum/1MB), [math]::Round($total/1MB)) -NoNewline -ForegroundColor DarkGray
                    $lastPct = $pct
                }
            }
        }
        $dst.Close(); $src.Close()
        Write-Host "`r       100%  $([math]::Round((Get-Item $OutFile).Length/1MB)) Mo downloaded.          " -ForegroundColor DarkGray
    }
    finally {
        if ($client) { $client.Dispose() }
    }
}

function Test-Url {
    param([string]$Url)
    try {
        $r = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 30
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

function Get-LatestNwjsVersion {
    $fallback = '0.118.0'
    try {
        Info 'Resolution de la derniere version stable de NW.js...'
        $html = (Invoke-WebRequest -Uri 'https://dl.nwjs.io/' -UseBasicParsing -TimeoutSec 30).Content
        $vers = [regex]::Matches($html, 'v(\d+\.\d+\.\d+)/') |
                ForEach-Object { [version]$_.Groups[1].Value } |
                Sort-Object -Unique -Descending
        if ($vers) { return ($vers[0]).ToString() }
    } catch {
        Warn "Resolution automatique impossible ($($_.Exception.Message))"
    }
    return $fallback
}

# ---------------------------------------------------------------------------
# Generation de l'icone (System.Drawing, aucune dependance)
# ---------------------------------------------------------------------------
function New-AppIcon {
    param([string]$OutFile, [int]$Size = 256)

    Add-Type -AssemblyName System.Drawing

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)

    # --- Fond arrondi en degrade ---
    $corner  = [int]($Size * 0.22)
    $d       = $corner * 2
    $gShape  = New-Object System.Drawing.Drawing2D.GraphicsPath
    $gShape.AddArc(0, 0, $d, $d, 180, 90)
    $gShape.AddArc($Size - $d, 0, $d, $d, 270, 90)
    $gShape.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
    $gShape.AddArc(0, $Size - $d, $d, $d, 90, 90)
    $gShape.CloseFigure()

    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($Size, $Size)),
        [System.Drawing.Color]::FromArgb(255, 10, 8, 30),
        [System.Drawing.Color]::FromArgb(255, 26, 19, 68))
    $g.FillPath($bgBrush, $gShape)

    # --- Halo nebuleuse ---
    $haloBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($Size, $Size)),
        [System.Drawing.Color]::FromArgb(185, 34, 211, 238),
        [System.Drawing.Color]::FromArgb(185, 139, 92, 246))
    $g.FillEllipse($haloBrush, [int]($Size*0.17), [int]($Size*0.17), [int]($Size*0.66), [int]($Size*0.66))

    # --- Anneau orbital ---
    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(175, 126, 240, 255), [float]($Size * 0.022))
    $g.DrawEllipse($ringPen, [int]($Size*0.06), [int]($Size*0.31), [int]($Size*0.88), [int]($Size*0.38))

    # --- Monogramme X + etoile (identique au logo de l'interface) ---
    $cx = $Size / 2.0
    $cy = $Size / 2.0
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 214, 201, 255), [float]($Size * 0.052))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
    $k = $Size * 0.39
    $g.DrawLine($pen, [float]($cx - $k), [float]($cy - $k), [float]($cx + $k), [float]($cy + $k))
    $g.DrawLine($pen, [float]($cx + $k), [float]($cy - $k), [float]($cx - $k), [float]($cy + $k))

    $pts = New-Object 'System.Drawing.PointF[]' 8
    $outer = $Size * 0.135
    $inner = $Size * 0.042
    for ($n = 0; $n -lt 8; $n++) {
        $ang = [Math]::PI / 4 * $n - [Math]::PI / 2
        $rad = if ($n % 2 -eq 0) { $outer } else { $inner }
        $pts[$n] = New-Object System.Drawing.PointF(
            [float]($cx + [Math]::Cos($ang) * $rad),
            [float]($cy + [Math]::Sin($ang) * $rad))
    }
    $starShape = New-Object System.Drawing.Drawing2D.GraphicsPath
    $starShape.AddPolygon($pts)
    $starBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 246, 240, 255))
    $g.FillPath($starBrush, $starShape)
    $g.Dispose()

    $dir = Split-Path -Parent $OutFile
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# ---------------------------------------------------------------------------
# Etapes
# ---------------------------------------------------------------------------
function Invoke-Clean {
    Step 'Nettoyage'
    Get-Process -Name $AppName -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    foreach ($d in @($DistDir, $BuildDir)) {
        if (Test-Path -LiteralPath $d) { Remove-Item -LiteralPath $d -Recurse -Force; Ok "Supprime : $d" }
    }
}

function Initialize-Cache {
    if (-not (Test-Path -LiteralPath $CacheDir)) {
        New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
        Ok "Cache cree : $CacheDir"
    }
}

function Resolve-Runtime {
    # 1. Version
    if (-not $NwjsVersion) { $script:NwjsVersion = Get-LatestNwjsVersion }
    else                   { $script:NwjsVersion = $NwjsVersion }

    $fileName = "nwjs-v$($script:NwjsVersion)-win-$Arch.zip"
    $urls = @(
        "https://dl.nwjs.io/v$($script:NwjsVersion)/$fileName",
        "https://github.com/nwjs/nw.js/releases/download/nw-v$($script:NwjsVersion)/$fileName",
        "https://registry.npmmirror.com/-/binary/nwjs/v$($script:NwjsVersion)/$fileName"
    )
    $zipPath = Join-Path $CacheDir $fileName

    # 2. Telechargement (avec cache)
    if (Test-Path -LiteralPath $zipPath) {
        Ok "Runtime deja en cache : $fileName"
    } else {
        Step "Telechargement du runtime NW.js $fileName"
        $ok = $false
        foreach ($u in $urls) {
            Info "Source : $u"
            try {
                Save-File -Url $u -OutFile $zipPath
                $ok = $true; break
            } catch {
                Warn "Echec : $($_.Exception.Message)"
                if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
            }
        }
        if (-not $ok) { Die 'Impossible de telecharger NW.js. Verifiez votre connexion, ou telechargez manuellement le zip sur https://nwjs.io et placez-le dans build\_cache avec le nom exact attendu.' }
        Ok 'Runtime telecharge.'
    }

    # 3. Extraction
    if (Test-Path -LiteralPath $RuntimeIn) { Remove-Item -LiteralPath $RuntimeIn -Recurse -Force }
    Step 'Extraction du runtime'
    $tmp = Join-Path $CacheDir '_extract'
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    Expand-Archive -LiteralPath $zipPath -DestinationPath $tmp -Force
    $inner = Get-ChildItem -LiteralPath $tmp -Directory | Select-Object -First 1
    if (-not $inner) { Die 'Archive NW.js inattendue.' }
    Move-Item -LiteralPath $inner.FullName -Destination $RuntimeIn -Force
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path -LiteralPath (Join-Path $RuntimeIn 'nw.exe'))) { Die 'nw.exe introuvable dans le runtime.' }
    Ok "Runtime pret : $RuntimeIn"
}

function Build-App {
    Step "Assemblage de l'application"

    # Copie du runtime
    if (Test-Path -LiteralPath $StageDir) { Remove-Item -LiteralPath $StageDir -Recurse -Force }
    New-Item -ItemType Directory -Path $StageDir -Force | Out-Null
    Copy-Item -Path (Join-Path $RuntimeIn '*') -Destination $StageDir -Recurse -Force
    Ok 'Runtime copie.'

    # Traductions NW.js : on ne garde que francais et anglais.
    # Le runtime en livre 228 fichiers pour 51 Mo, dont personne n'a
    # besoin ici. L'application est en francais, ca suffit largement.
    $localeDir = Join-Path $StageDir 'locales'
    if (Test-Path -LiteralPath $localeDir) {
        $garder = @('fr', 'en-US', 'en-GB')
        $avant = (Get-ChildItem -LiteralPath $localeDir -File | Measure-Object Length -Sum).Sum
        $aSupprimer = Get-ChildItem -LiteralPath $localeDir -File | Where-Object {
            $langue = (($_.Name -replace '\.pak(\.info)?$', '') -split '_')[0]
            -not ($garder -contains $langue)
        }
        foreach ($f in $aSupprimer) { Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue }
        $apres = (Get-ChildItem -LiteralPath $localeDir -File | Measure-Object Length -Sum).Sum
        $gagne = [math]::Round(($avant - $apres) / 1MB, 1)
        if ($gagne -gt 0) { Ok "Traductions : FR + EN uniquement, $gagne Mo economises." }
    }

    # Icone
    $iconDir = Join-Path $StageDir 'assets'
    if (-not (Test-Path -LiteralPath $iconDir)) { New-Item -ItemType Directory -Path $iconDir -Force | Out-Null }
    $iconPath = Join-Path $iconDir 'icon.png'
    if (Test-Path -LiteralPath (Join-Path $Root 'assets\icon.png')) {
        Copy-Item -LiteralPath (Join-Path $Root 'assets\icon.png') -Destination $iconPath -Force
        Ok 'Icone utilisateur copiee.'
    } else {
        New-AppIcon -OutFile $iconPath
        Ok 'Icone generee automatiquement.'
    }

    # Fichiers de l'application
    $payload = @('index.html','style.css','ui.js','main.js','config.json')
    foreach ($f in $payload) {
        $src = Join-Path $Root $f
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination $StageDir -Force
            Ok "$f copie."
        } else {
            Warn "$f introuvable (ignore)."
        }
    }

    # Sous-dossier lib/ (back-end Node)
    $libSrc = Join-Path $Root 'lib'
    if (Test-Path -LiteralPath $libSrc) {
        Copy-Item -LiteralPath $libSrc -Destination $StageDir -Recurse -Force
        $n = (Get-ChildItem -LiteralPath (Join-Path $StageDir 'lib') -File).Count
        Ok "lib\ copie ($n modules)."
    }

    # Doc dans la distribution
    $readme = Join-Path $Root 'README.md'
    if (Test-Path -LiteralPath $readme) { Copy-Item -LiteralPath $readme -Destination $StageDir -Force }

    # manifest package.json (nom + icones mis a jour)
    $srcManifest = Join-Path $Root 'package.json'
    if (Test-Path -LiteralPath $srcManifest) {
        $m = Get-Content -LiteralPath $srcManifest -Raw | ConvertFrom-Json
        $m.name     = ($AppName -replace '[^A-Za-z0-9_.-]', '-').ToLower()
        $m.main     = 'index.html'       # la fenetre charge index.html (main.js est inclus via <script>)
        $m | Add-Member -NotePropertyName 'chromium-args' -NotePropertyValue '--autoplay-policy=no-user-gesture-required --disable-features=CalculateNativeWinOcclusion' -Force
        if ($m.window) {
            $m.window | Add-Member -NotePropertyName 'icon'     -NotePropertyValue 'assets/icon.png' -Force
            $m.window | Add-Member -NotePropertyName 'title'    -NotePropertyValue $Title              -Force
            $m.window | Add-Member -NotePropertyName 'frame'    -NotePropertyValue $false               -Force
        } else {
            $m | Add-Member -NotePropertyName 'window' -NotePropertyValue ([pscustomobject]@{
                icon = 'assets/icon.png'; title = $Title; width = 1440; height = 900; frame = $false
            }) -Force
        }
        $json = $m | ConvertTo-Json -Depth 8
        [System.IO.File]::WriteAllText((Join-Path $StageDir 'package.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
        Ok 'Manifeste package.json genere.'
    } else {
        Warn 'package.json introuvable a la racine : manifeste minimal genere.'
        $fallback = @{ name = $AppName.ToLower(); main = 'main.js'; window = @{ icon = 'assets/icon.png'; title = $Title; frame = $false; width = 1600; height = 920 } }
        [System.IO.File]::WriteAllText((Join-Path $StageDir 'package.json'), ($fallback | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
    }

    # Renommage du binaire
    $nw = Join-Path $StageDir 'nw.exe'
    $out = Join-Path $StageDir "$AppName.exe"
    if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
    Rename-Item -LiteralPath $nw -NewName "$AppName.exe"
    Ok "Binaire : $AppName.exe"

    # Icone du fichier .exe (barre des taches / Explorateur)
    $iconTool = Join-Path $Root 'tools\set-exe-icon.ps1'
    if (Test-Path -LiteralPath $iconTool) {
        $exePath = Join-Path $StageDir "$AppName.exe"
        $pngPath = Join-Path $StageDir 'assets\icon.png'
        if ((Test-Path -LiteralPath $pngPath) -and (Test-Path -LiteralPath $exePath)) {
            & $iconTool -Exe $exePath -Png $pngPath 2>$null |
                ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray }
        }
    }
}

function New-Readme {
    $txt = @"
$Title
========================================
Lanceur construit avec XRN Build (NW.js portable).

Lancement  : double-cliquez sur $AppName.exe
Dossier    : $AppName/

Aucun installation de Node.js / Electron n'est necessaire.
Le dossier est 100 % portable : copiez-le ou deplacez-le librement.

IMPORTANT - premiere utilisation
  1. Editez config.json et renseignez microsoftClientId
     (portail Azure > Microsoft Entra ID > Enregistrements d'applications
      > Public client > "Autoriser les flux de client public" = Yes).
  2. L'application cree %APPDATA%\XRNLauncher\ (config, comptes, jetons).
  3. Le dossier du jeu par defaut est %APPDATA%\XRNLauncher\minecraft
     (modifiable dans config.json, cle gameDir).

Premier lancement
  Onglet Connexion > Microsoft > collez le code affiche.
  Les sauvegardes, mods, packs et captures vivent dans le dossier du jeu.

Raccourcis
  Ctrl + K       recherche
  Ctrl + Entree  lancer Minecraft

Runtime : NW.js $script:NwjsVersion ($Arch / $Flavor)
Genere le : $(Get-Date -Format 'dd/MM/yyyy HH:mm')
"@
    Set-Content -LiteralPath (Join-Path $StageDir 'LISEZ-MOI.txt') -Value $txt -Encoding UTF8
}

function Compress-Dist {
    Step 'Compression en .zip'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $v = '3.5.0'
    $zip = Join-Path $DistDir "$AppName-v$v-win-$Arch.zip"
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $StageDir, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    $size = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)
    Ok ("Archive : dist\{0}  ({1} Mo)" -f (Split-Path -Leaf $zip), $size)
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
Banner

try {
    if (-not (Test-Path -LiteralPath $PayloadIn)) { Die "index.html introuvable dans $Root" }

    if ($Clean) { Invoke-Clean }

    Initialize-Cache
    Resolve-Runtime
    Build-App
    New-Readme

    if (-not $SkipZip) { Compress-Dist }

    Step 'Termine'
    Write-Host "       Dossier  : $StageDir" -ForegroundColor Gray
    Write-Host "       Executable : $(Join-Path $StageDir "$AppName.exe")" -ForegroundColor Gray
    Write-Host "       Zip      : $(Join-Path $DistDir "$AppName-v3.5.0-win-$Arch.zip")" -ForegroundColor Gray

    if ($Run) {
        Step 'Lancement'
        Start-Process -FilePath (Join-Path $StageDir "$AppName.exe")
    }
    Write-Host "`n  Bonnepartie !`n" -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host "  [ERREUR] $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ScriptStackTrace) { Write-Host "  $($_.ScriptStackTrace)" -ForegroundColor DarkRed }
    Write-Host ''
    exit 1
}