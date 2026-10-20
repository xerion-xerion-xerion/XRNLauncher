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
    [switch]$Clean,
    # Identifiant technique de l'application. NW.js en deduit le dossier
    # de profil : deux versions qui partagent le meme identifiant
    # partagent le meme profil, et la seconde se ferme en annonçant
    # "ouverture dans une session de navigateur existante". Il faut
    # donc qu'il soit unique par version, meme si le dossier de
    # donnees (sauvegardes, logs) reste partage.
    [string]$AppId       = '',
    # Identifiant d application Azure livre avec la distribution.
    # Vide : le launcher part sans identifiant et l utilisateur declare
    # le sien dans Parametres > Connexion Microsoft. C est le mode
    # recommande pour une distribution publique : l application de
    # l auteur ne doit pas etre imposee a tout le monde.
    [string]$ClientId    = ''
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

# Version de l'application : sert a rendre unique le nom technique
# (donc le profil NW.js) de chaque installation.
$Version = '0.0.0'
try {
    $manifestCourant = Get-Content -LiteralPath (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
    if ($manifestCourant.version) { $Version = [string]$manifestCourant.version }
} catch { }

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
#  L icone est dessinee par tools/new-icon.ps1, qui reprend exactement le
#  logo de la barre de titre (SVG et couleurs de style.css). Une seule
#  source de verite : le fichier assets/icon.png, s il existe, prime
#  sur tout le reste.
function New-AppIcon {
    param([string]$OutFile, [int]$Size = 1024)
    $generateur = Join-Path $Root 'tools\new-icon.ps1'
    if (Test-Path -LiteralPath $generateur) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $generateur -OutFile $OutFile -Size $Size | Out-Null
        return
    }
    Warn 'tools\new-icon.ps1 introuvable : l icone generee n aura pas le bon design.'
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
    $payload = @('index.html','style.css','ui.js','main.js','notification.json')
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

    # Sous-dossier tools/ : le renommage de la fenetre du jeu s'appuie
    # sur un script PowerShell qui doit etre livre avec l'application.
    # Sans lui, le jeu se lance mais garde le titre "Minecraft 1.21.11".
    $toolsSrc = Join-Path $Root 'tools'
    if (Test-Path -LiteralPath $toolsSrc) {
        $toolsDst = Join-Path $StageDir 'tools'
        New-Item -ItemType Directory -Path $toolsDst -Force | Out-Null
        Copy-Item -Path (Join-Path $toolsSrc '*') -Destination $toolsDst -Recurse -Force
        $k = @(Get-ChildItem -LiteralPath $toolsDst -File -Filter '*.ps1').Count
        Ok "tools\ copie ($k scripts)."
        if (-not (Test-Path -LiteralPath (Join-Path $toolsDst 'rename-window.ps1'))) {
            Warn "rename-window.ps1 absent : le titre de la fenetre du jeu ne sera pas change."
        }
    }

    # Point d entree des notifications : l adresse vient du fichier
    # local de la machine, pour que rien de personnel n entre dans le
    # depot public.
    $notifUrl = ''
    try {
        $cfgLocale = Get-Content -LiteralPath (Join-Path $Root 'config.local.json') -Raw | ConvertFrom-Json
        if ($cfgLocale.notificationUrl) { $notifUrl = [string]$cfgLocale.notificationUrl }
    } catch { }
    if ($notifUrl) {
        $notifDst = Join-Path $StageDir 'notification.json'
        if (Test-Path -LiteralPath $notifDst) {
            $notif = Get-Content -LiteralPath $notifDst -Raw | ConvertFrom-Json
            $notif.url = $notifUrl
            [System.IO.File]::WriteAllText($notifDst, ($notif | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false))
            Ok 'Point d entree des notificationsConfigure.'
        }
    }

    # Mods integres : XRN HUD est livre avec le launcher et recopie
    # dans le dossier mods du jeu au moment du lancement.
    $modsSrc = Join-Path $Root 'mods-integres'
    if (Test-Path -LiteralPath $modsSrc) {
        $modsDst = Join-Path $StageDir 'mods-integres'
        New-Item -ItemType Directory -Path $modsDst -Force | Out-Null
        Copy-Item -Path (Join-Path $modsSrc '*') -Destination $modsDst -Recurse -Force
        $j = @(Get-ChildItem -LiteralPath $modsDst -File -Filter '*.jar')
        if ($j.Count -gt 0) {
            Ok ("mods-integres\ copie (" + $j.Count + " mod(s) : " + (($j.Name) -join ', ') + ").")
        } else {
            Warn "mods-integres\ est vide : le menu du jeu sera indisponible."
        }
    }

    # L identifiant d application Azure n est pas un secret : c est un
    # identifiant public, present dans toute copie installee. On le
    # prend donc dans un fichier local, ignore par git, pour que le
    # depot public reste vierge de toute donnee personnelle.
    if (-not $ClientId) {
        $cfgLocale = Join-Path $Root 'config.local.json'
        if (Test-Path -LiteralPath $cfgLocale) {
            try {
                $local = Get-Content -LiteralPath $cfgLocale -Raw | ConvertFrom-Json
                if ($local.microsoftClientId) { $ClientId = [string]$local.microsoftClientId }
            } catch { }
        }
    }

    # Config livree : modele vierge, sans reglage personnel, et avec
    # l identifiant d application choisi pour cette distribution.
    #
    # L adresse du point d entree des notifications vient aussi du
    # fichier local, jamais du depot : le depot public reste neutre.
    $cfgSrc = Join-Path $Root 'config.json'
    if (Test-Path -LiteralPath $cfgSrc) {
        $cfg = Get-Content -LiteralPath $cfgSrc -Raw | ConvertFrom-Json
        #  Aucune trace de la machine de l auteur : ni dossier de jeu,
        #  ni chemin de Java, ni profil memorise.
        $cfg.gameDir = ''
        $cfg.javaPath = ''
        $cfg.javaArgs = ''
        $cfg | Add-Member -NotePropertyName 'lastVersion' -NotePropertyValue $null -Force
        $cfg | Add-Member -NotePropertyName 'lastProfile' -NotePropertyValue $null -Force
        $cfg | Add-Member -NotePropertyName 'offlineProfiles' -NotePropertyValue @() -Force
        if ($ClientId) { $cfg | Add-Member -NotePropertyName 'microsoftClientId' -NotePropertyValue $ClientId -Force }
        else { $cfg | Add-Member -NotePropertyName 'microsoftClientId' -NotePropertyValue '' -Force }
        $jsonCfg = $cfg | ConvertTo-Json -Depth 8
        [System.IO.File]::WriteAllText((Join-Path $StageDir 'config.json'), $jsonCfg, (New-Object System.Text.UTF8Encoding($false)))
        Ok ('Config livree generee' + $(if ($ClientId) { ' (application Azure incluse).' } else { ' (aucune application incluse).' }))
    }

    # Doc dans la distribution
    $readme = Join-Path $Root 'README.md'
    if (Test-Path -LiteralPath $readme) { Copy-Item -LiteralPath $readme -Destination $StageDir -Force }

    # manifest package.json (nom + icones mis a jour)
    $srcManifest = Join-Path $Root 'package.json'
    if (Test-Path -LiteralPath $srcManifest) {
        $m = Get-Content -LiteralPath $srcManifest -Raw | ConvertFrom-Json
        #  Le "name" n est pas cosmétique : NW.js en déduit le dossier de
        #  profil. Deux versions qui le partagent se ferment mutuellement
        #  ("ouverture dans une session de navigateur existante"). On y
        #  ajoute donc la version, qui est unique par installation.
        $appId = if ($AppId) { $AppId } else { $AppName }
        $m.name     = (($appId -replace '[^A-Za-z0-9_.-]', '-').ToLower() + '-v' + $m.version)
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
        $appId = if ($AppId) { $AppId } else { $AppName }
        $fallback = @{ name = (($appId -replace '[^A-Za-z0-9_.-]', '-').ToLower() + '-v' + $Version); main = 'main.js'; window = @{ icon = 'assets/icon.png'; title = $Title; frame = $false; width = 1600; height = 920 } }
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
  1. Pour te connecter, il faut un identifiant d application Azure :
     portail Azure > Microsoft Entra ID > Enregistrements d'applications
      > Public client > "Autoriser les flux de client public" = Yes.
     Colle-le dans Parametres > Connexion Microsoft, ou dans le
     config.json du dossier, cle microsoftClientId.
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

# ---------------------------------------------------------------------------
# Version
# ---------------------------------------------------------------------------
# Le numero de version vit dans package.json, et nulle part ailleurs.
# Il etait ecrit en dur ici, ce qui faisait qu'un build pouvait s'appeler
# "3.5.0" alors que le code etait deja passe a autre chose : deux versions
# Different alors portaient le meme nom de fichier.
$script:VersionCache = $null
function Get-Version {
    if ($script:VersionCache) { return $script:VersionCache }
    $p = Join-Path $Root 'package.json'
    if (Test-Path -LiteralPath $p) {
        try {
            $j = Get-Content -LiteralPath $p -Raw | ConvertFrom-Json
            if ($j.version) { $script:VersionCache = [string]$j.version; return $script:VersionCache }
        } catch { /* fichier illisible : on garde la valeur par defaut */ }
    }
    $script:VersionCache = '0.0.0'
    return $script:VersionCache
}

function Compress-Dist {
    Step 'Compression en .zip'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $v = Get-Version
    $zip = Join-Path $DistDir "$AppName-v$v-win-$Arch.zip"
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }

    #  L archive contient un DOSSIER RACINE, nomme comme l archive.
    #  Sans cela, l extraction depose les 78 fichiers a plat dans le
    #  dossier choisi : l application se melange a ce qui s y trouve
    #  deja, et l extraction "ici" ne cree aucun dossier.
    $racine = "$AppName-v$v-win-$Arch"
    $fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
    try {
        $archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            $fichiers = Get-ChildItem -LiteralPath $StageDir -Recurse -File
            foreach ($f in $fichiers) {
                $rel = $f.FullName.Substring($StageDir.Length).TrimStart('\', '/')
                $entree = $archive.CreateEntry(("$racine/" + $rel.Replace('\', '/')), [System.IO.Compression.CompressionLevel]::Optimal)
                $es = $entree.Open()
                try {
                    $src = [System.IO.File]::OpenRead($f.FullName)
                    try { $src.CopyTo($es) } finally { $src.Dispose() }
                } finally { $es.Dispose() }
            }
        } finally { $archive.Dispose() }
    } finally { $fs.Dispose() }

    $size = [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)
    Ok ("Archive : dist\{0}  ({1} Mo)" -f (Split-Path -Leaf $zip), $size)
    Ok "Dossier racine dans l archive : $racine"
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
    Write-Host "       Zip      : $(Join-Path $DistDir "$AppName-v$(Get-Version)-win-$Arch.zip")" -ForegroundColor Gray

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