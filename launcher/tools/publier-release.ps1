#Requires -Version 5.1
<#
    Publie une version du launcher sur GitHub.

    Les assets de la release sont au nombre de quatre :

      - XRNLauncher-win-x64.zip     l'archive complete (nom stable : le
                                     lien "releases/latest/download" doit
                                     toujours pointer sur la meme adresse)
      - XRNLauncher-patch.zip        les seuls fichiers modifies
      - XRNLauncher-manifest.json    la liste des fichiers et leurs
                                     empreintes, qui dit au launcher si
                                     le patch lui convient
      - XRN-Installer.cmd            l'installeur

    Apres la publication, le manifeste devient la reference du patch
    suivant : c'est la version que les joueurs ont sur le disque.

    Le jeton GitHub est pris dans le gestionnaire d'identifiants de
    Windows (git credential fill), comme cela se fait pour les push.
#>
[CmdletBinding()]
param(
    [string]$Version = '',
    [string]$Notes = '',
    [switch]$SansMaj
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root 'dist'
$Repo = 'xerion-xerion-xerion/XRNLauncher'
$Api = "https://api.github.com/repos/$Repo"

if (-not $Version) {
    $Version = (Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
}
$Tag = "v$Version"

# --- jeton ---------------------------------------------------------------
$cred = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
$token = ($cred | Select-String '^password=').ToString() -replace '^password=', ''
if (-not $token) { throw "Jeton GitHub introuvable (git credential fill)" }
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/vnd.github+json'; 'User-Agent' = 'XRNLauncher-publish' }

# --- assets --------------------------------------------------------------
$zipVersionne = Join-Path $Dist "XRNLauncher-v$Version-win-x64.zip"
if (-not (Test-Path -LiteralPath $zipVersionne)) { throw "Archive introuvable : $zipVersionne" }

$prep = Join-Path $env:TEMP ("xrn-pub-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $prep -Force | Out-Null
try {
    #  L'asset d'archive porte un nom stable : le lien de l'installeur
    #  pointe dessus, et il ne doit pas changer a chaque version.
    $assets = @()
    $zip = Join-Path $prep 'XRNLauncher-win-x64.zip'
    Copy-Item -LiteralPath $zipVersionne -Destination $zip -Force
    $assets += $zip
    foreach ($nom in @('XRNLauncher-patch.zip','XRNLauncher-manifest.json','XRN-Installer.cmd')) {
        $src = Join-Path $Dist $nom
        if (Test-Path -LiteralPath $src) {
            $dst = Join-Path $prep $nom
            Copy-Item -LiteralPath $src -Destination $dst -Force
            $assets += $dst
        }
    }

    Write-Host "  Version   : $Tag" -ForegroundColor Cyan
    foreach ($a in $assets) {
        Write-Host ("  Asset     : {0}  ({1} Mo)" -f (Split-Path -Leaf $a), [math]::Round((Get-Item $a).Length / 1MB, 1)) -ForegroundColor DarkGray
    }

    # --- creation de la release -----------------------------------------
    #  Si la release existe deja (publication relancee), on la reutilise
    #  plutot que d echouer : c'est le moyen de republier apres un
    #  echec d'envoi.
    $corps = if ($Notes) { $Notes } else { "XRNLauncher $Version." }
    $release = $null
    try {
        $existantes = Invoke-RestMethod -Uri "$Api/releases" -Headers $headers
        $release = $existantes | Where-Object { $_.tag_name -eq $Tag } | Select-Object -First 1
    } catch { }

    if ($release) {
        Write-Host "  Release   : deja existante, on la met a jour" -ForegroundColor DarkGray
        $release = Invoke-RestMethod -Method Patch -Uri "$Api/releases/$($release.id)" -Headers $headers `
            -Body ([Text.Encoding]::UTF8.GetBytes((@{ name = "XRNLauncher $Version"; body = $corps } | ConvertTo-Json))) `
            -ContentType 'application/json'
    } else {
        $payload = @{
            tag_name    = $Tag
            name        = "XRNLauncher $Version"
            body        = $corps
            draft       = $false
            prerelease  = $false
        } | ConvertTo-Json -Depth 5
        $release = Invoke-RestMethod -Method Post -Uri "$Api/releases" -Headers $headers `
            -Body ([Text.Encoding]::UTF8.GetBytes($payload)) -ContentType 'application/json'
    }
    Write-Host "  Release   : $($release.html_url)" -ForegroundColor Green

    #  L 'envoi se fait sur uploads.github.com : c'est l'hote du
    #  televersement des assets, distinct de celui de l'API.
    $uploadUrl = ([string]$release.upload_url) -replace '\{.*\}$',''

    # --- televersement ---------------------------------------------------
    foreach ($a in $assets) {
        $nom = Split-Path -Leaf $a
        $deja = @($release.assets) | Where-Object { $_.name -eq $nom } | Select-Object -First 1
        if ($deja) {
            #  On remplace : le contenu a change depuis le dernier envoi.
            Write-Host "  Remplacement: $nom" -ForegroundColor DarkGray
            & curl.exe -sS -L --fail-with-body --max-time 300 `
                -H "Authorization: Bearer $token" `
                -H "Accept: application/vnd.github+json" `
                -H "X-GitHub-Api-Version: 2022-11-28" `
                -X DELETE "$Api/releases/assets/$($deja.id)" | Out-Null
        }
        Write-Host "  Envoi     : $nom ..." -ForegroundColor DarkGray
        $url = $uploadUrl + '?name=' + [uri]::EscapeDataString($nom)
        & curl.exe -sS -L --fail-with-body --max-time 3600 `
            -H "Authorization: Bearer $token" `
            -H "Accept: application/vnd.github+json" `
            -H "X-GitHub-Api-Version: 2022-11-28" `
            -H "Content-Type: application/octet-stream" `
            --upload-file $a `
            -X POST $url | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Envoi echoue : $nom" }
    }

    # --- le manifeste publie devient la reference du patch suivant ------
    $manifeste = Join-Path $Dist 'XRNLauncher-manifest.json'
    if (Test-Path -LiteralPath $manifeste) {
        Copy-Item -LiteralPath $manifeste -Destination (Join-Path $Dist 'manifeste-precedent.json') -Force
        Write-Host "  Reference : dist\manifeste-precedent.json mis a jour" -ForegroundColor DarkGray
    }

    Write-Host "`n  Publication terminee : $Tag" -ForegroundColor Green
}
finally {
    Remove-Item -LiteralPath $prep -Recurse -Force -ErrorAction SilentlyContinue
}
