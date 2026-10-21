#Requires -Version 5.1
<#
    Genere l'icone de l'application, identique au logo de la barre de
    titre et du site.

    L'icone est dessinee a la taille demandee, et non reduite depuis
    une grande image : reduire efface les traits fins, et une icone de
    bureau reductions a 32 ou 48 pixels devient une suite de pointilles.
    On epaissit donc tout ce qui doit rester visible en petit.

    Depuis le rework 4.2.0, l'icone suit exactement la marque du hero :
    une croix violette et une etoile blanche, sur un fond violet tres
    sombre. Les orbites fines ont ete retirees : a 48 pixels elles ne
    sont qu'une grouille de pixels gris autour de la croix.

    Les couleurs viennent de style.css :
      fond       #2a2050 -> #14102a, degrade diagonal tres sobre
      croix      #b9a0ff
      etoile     #f5eeff
#>
[CmdletBinding()]
param(
    [string]$OutFile = (Join-Path $PSScriptRoot '..\assets\icon.png'),
    [int]$Size = 1024
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Chemin-Arrondi($x, $y, $w, $h, $r) {
    $d = [int]($r * 2)
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x, $y, $d, $d, 180, 90)
    $p.AddArc(($x + $w - $d), $y, $d, $d, 270, 90)
    $p.AddArc(($x + $w - $d), ($y + $h - $d), $d, $d, 0, 90)
    $p.AddArc($x, ($y + $h - $d), $d, $d, 90, 90)
    $p.CloseFigure()
    return $p
}

# --- echelle : le dessin est concu en 64 unites, comme la police ------
$U = $Size / 64.0

$bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# --- fond : un degrade diagonal violet, assez clair pour que la
#     silhouette de la croix se detache sur un bureau clair ou sombre ---
$coins = 13.0 * $U
$formeFond = Chemin-Arrondi 0 0 $Size $Size $coins
$degradeFond = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.PointF([float]($Size * 0.12), [float]($Size * 0.02))),
    (New-Object System.Drawing.PointF([float]($Size * 0.88), [float]($Size * 0.98))),
    [System.Drawing.Color]::FromArgb(255, 0x2A, 0x20, 0x50),
    [System.Drawing.Color]::FromArgb(255, 0x14, 0x10, 0x2A))
$g.FillPath($degradeFond, $formeFond)
$degradeFond.Dispose()

# --- liseré violet : il donne le contour de l icone sur un fond clair ---
$liser = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150, 0xA7, 0x8B, 0xFA), [single](0.9 * $U))
$g.DrawPath($liser, $formeFond)
$liser.Dispose()

# --- la croix : le trait epais reste continu a 32 pixels ------------
$largeurCroix = 6.2 * $U
$ax = 19.5 * $U; $ay = 15.0 * $U
$bx = 44.5 * $U; $by = 49.0 * $U
$cx = 44.5 * $U; $cy = 15.0 * $U
$dx = 19.5 * $U; $dy = 49.0 * $U

$croix = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 0xB9, 0xA0, 0xFF), [single]$largeurCroix)
$croix.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$croix.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($croix, [float]$ax, [float]$ay, [float]$bx, [float]$by)
$g.DrawLine($croix, [float]$cx, [float]$cy, [float]$dx, [float]$dy)
$croix.Dispose()

# --- l etoile : quatre branches, nette a toutes les tailles -----------
$etoile = @(
    @(32.0, 23.0), @(33.8, 30.2), @(41.0, 32.0), @(33.8, 33.8),
    @(32.0, 41.0), @(30.2, 33.8), @(23.0, 32.0), @(30.2, 30.2)
)
$points = New-Object 'System.Drawing.PointF[]' $etoile.Count
for ($i = 0; $i -lt $etoile.Count; $i++) {
    $points[$i] = New-Object System.Drawing.PointF(
        [float]($etoile[$i][0] * $U), [float]($etoile[$i][1] * $U))
}
$remplissage = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0xF5, 0xEE, 0xFF))
$g.FillPolygon($remplissage, $points)
$remplissage.Dispose()

$g.Dispose()

$dossier = Split-Path -Parent $OutFile
if ($dossier -and -not (Test-Path -LiteralPath $dossier)) {
    New-Item -ItemType Directory -Path $dossier -Force | Out-Null
}
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "  icone generee : $OutFile ($Size x $Size)"
