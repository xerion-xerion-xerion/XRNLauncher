#Requires -Version 5.1
<#
    La cape Galaxie : une nebuleuse teal et verte, des etoiles.
    Dessinee huit fois plus grande puis reduite : les bords sont
    doux, sans escalier de pixels.

    Toute la texture 64 x 64 est remplie : quelle que soit la zone
    que le jeu echantillonne, on reste dans le meme ciel.
#>
[CmdletBinding()]
param(
    [int]$Taille = 64,
    [string]$Fichier = '',
    [string]$Apercu = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$racine = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Fichier) { $Fichier = Join-Path $racine '..\src\main\resources\assets\xrnhud\textures\cape_xrn.png' }
if (-not $Apercu)  { $Apercu  = Join-Path $racine '..\src\main\resources\assets\xrnhud\textures\preview\cape_xrn.png' }

function DessinerGalaxie {
    param([string]$Fichier, [int]$Taille, [int]$Fois)

    $T = $Taille * $Fois          #  la toile, surdimmensionnee
    $rnd = New-Object System.Random 42   #  la meme image a chaque fois

    $b = New-Object System.Drawing.Bitmap $T, $T, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::FromArgb(255, 6, 18, 24))

    #  Le fond : du haut, plus clair et teal, vers le bas presque noir.
    $rect = New-Object System.Drawing.Rectangle 0, 0, $T, $T
    $fond = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, 0xFF0B2A33, 0xFF02090D, 90.0)
    $g.FillRectangle($fond, $rect)
    $fond.Dispose()

    #  La nebuleuse : de grands voiles teal et vert, tres transparents,
    #  qui se superposent. Un PathGradientBrush donne le coeur clair
    #  et le bord fondu.
    $voiles = @(
        @(0.50, 0.35, 0.52, 'FF16B8A6', 0.55),
        @(0.30, 0.60, 0.44, 'FF0E7490', 0.45),
        @(0.70, 0.55, 0.50, 'FF22D3AA', 0.40),
        @(0.55, 0.80, 0.38, 'FF14B8A6', 0.30),
        @(0.20, 0.25, 0.30, 'FF1B6E7A', 0.35),
        @(0.80, 0.20, 0.26, 'FF2DD4BF', 0.25)
    )
    foreach ($v in $voiles) {
        $cx = $v[0] * $T ; $cy = $v[1] * $T ; $r = $v[2] * $T
        $alpha = [int]([float]$v[4] * 255)
        $chemin = New-Object System.Drawing.Drawing2D.GraphicsPath
        $chemin.AddEllipse([float]($cx - $r), [float]($cy - $r), [float](2 * $r), [float](2 * $r))
        $voile = New-Object System.Drawing.Drawing2D.PathGradientBrush($chemin)
        $voile.CenterColor = [System.Drawing.Color]::FromArgb($alpha, [System.Drawing.Color]::FromArgb([int]('0x' + $v[3])))
        $voile.CenterPoint = New-Object System.Drawing.PointF ([float]$cx), ([float]$cy)
        $couleurBord = [System.Drawing.Color]::FromArgb(0, 6, 18, 24)
        $voile.SurroundColors = , $couleurBord
        $g.FillEllipse($voile, [float]($cx - $r), [float]($cy - $r), [float](2 * $r), [float](2 * $r))
        $voile.Dispose()
        $chemin.Dispose()
    }

    #  Les etoiles : fines, claires, quelques-unes brillantes.
    $n = 110
    for ($i = 0; $i -lt $n; $i++) {
        $x = $rnd.NextDouble() * $T
        $y = $rnd.NextDouble() * $T
        $r = (0.5 + $rnd.NextDouble() * 1.6) * $Fois
        $claire = $rnd.NextDouble()
        $alpha = if ($claire -gt 0.85) { 255 } else { [int](90 + $claire * 100) }
        $pinceau = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        $g.FillEllipse($pinceau, [float]($x - $r), [float]($y - $r), [float](2 * $r), [float](2 * $r))
        $pinceau.Dispose()
        if ($claire -gt 0.92) {
            #  Une croix lumineuse autour des plus brillantes.
            $croix = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 255, 255, 255)), ([float](0.7 * $Fois))
            $L = 3.2 * $Fois
            $g.DrawLine($croix, [float]($x - $L), [float]$y, [float]($x + $L), [float]$y)
            $g.DrawLine($croix, [float]$x, [float]($y - $L), [float]$x, [float]($y + $L))
            $croix.Dispose()
        }
    }

    #  On reduit : la nettete vient du sous-echantillonnage.
    $petit = New-Object System.Drawing.Bitmap $Taille, $Taille, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g2 = [System.Drawing.Graphics]::FromImage($petit)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g2.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 0, $Taille, $Taille),
        (New-Object System.Drawing.Rectangle 0, 0, $T, $T), [System.Drawing.GraphicsUnit]::Pixel)
    $g2.Dispose()
    $g.Dispose()
    $b.Dispose()

    $petit.Save($Fichier, [System.Drawing.Imaging.ImageFormat]::Png)
    $petit.Dispose()
    Write-Host ("  {0}" -f (Split-Path -Leaf $Fichier)) -ForegroundColor DarkGray
}

#  La cape, et son apercu pour la garde-robe.
DessinerGalaxie -Fichier $Fichier -Taille 64 -Fois 8
DessinerGalaxie -Fichier $Apercu -Taille 128 -Fois 5

Write-Host "Cape Galaxie generee." -ForegroundColor Green
