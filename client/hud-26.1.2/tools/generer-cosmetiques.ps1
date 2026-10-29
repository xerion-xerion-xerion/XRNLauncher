#Requires -Version 5.1
<#
    Genere les textures des cosmetiques du client.

    Les textures de cape du jeu font 64 x 64 : la cape n'en occupe que
    la partie haute. C ete la source d une cape qui s affichait en
    mosaïque : le jeu samplait une zone qui n'existait pas, et le
    motif se repetait.

    Repere dans la texture 64 x 64 :

      - 1,1    la face interieure (contre le dos), 10 x 16
      - 12,1   la face exterieure (ce qu on voit), 10 x 16
      - 23,1   le bord du haut
      - 34,1   le bord du bas

    On remplit tout le fond avec le degrade du cosmetique : quelle que
    soit la zone samplee, la cape reste aux couleurs du launcher.
#>
[CmdletBinding()]
param(
    [string]$Dossier = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$racine = Split-Path -Parent $MyInvocation.MyCommand.Path
$sortie = Join-Path $racine '..\src\main\resources\assets\xrnhud\textures'
if (-not (Test-Path -LiteralPath $sortie)) { New-Item -ItemType Directory -Path $sortie -Force | Out-Null }

# --- un degrade, et un motif, dessines en grand puis reduits -----------
#  On dessine a huit fois la taille, on reduit : les bords sont nets,
#  sans escalier. C est la difference entre une texture qui fait
#  "cote" et une texture qui fait propre.
function DessinerCape {
    param([string]$Fichier, [string]$Haut, [string]$Bas, [string]$Accent, [string]$Motif)

    $T = 8
    $b = New-Object System.Drawing.Bitmap (64 * $T), (64 * $T), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

    #  Les couleurs sont des entiers ARGB : PowerShell melange deux
    #  versions de System.Drawing, et les objets Color finissent par
    #  ne plus etre acceptes par le constructeur du degrade.        
    $haut = [Convert]::ToInt32($Haut, 16)
    $bas = [Convert]::ToInt32($Bas, 16)
    $accent = [Convert]::ToInt32($Accent, 16)

    #  Le fond : un degrade vertical, sur toute la texture.
    $rect = New-Object System.Drawing.Rectangle 0, 0, (64 * $T), (64 * $T)
    $degrade = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $haut, $bas, 90.0)
    $g.FillRectangle($degrade, $rect)
    $degrade.Dispose()
    #  Le motif, sur les deux faces : l interieure (1,1) et l exterieure
    #  (12,1). C est la que le jeu va les chercher.
    for ($f = 0; $f -lt 2; $f++) {
        $dx = $f * 11
        if ($Motif -eq 'x') {
            $p = New-Object System.Drawing.Pen ([int]($accent)), (2.2 * $T)
            $p.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
            $p.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
            $g.DrawLine($p, (3 + $dx) * $T, 5 * $T, (13 + $dx) * $T, 15 * $T)
            $g.DrawLine($p, (13 + $dx) * $T, 5 * $T, (3 + $dx) * $T, 15 * $T)
            $p.Dispose()
            $g.FillEllipse((New-Object System.Drawing.SolidBrush ([int]($accent))), (6.2 + $dx) * $T, 8.2 * $T, 3.6 * $T, 3.6 * $T)
        } elseif ($Motif -eq 'vagues') {
            $p = New-Object System.Drawing.Pen ([int]($accent)), (1.1 * $T)
            for ($k = 0; $k -lt 5; $k++) {
                $y = (2 + $k * 3) * $T
                $g.DrawBezier($p, (1 + $dx) * $T, $y, (5 + $dx) * $T, ($y - 1.6 * $T), (11 + $dx) * $T, ($y + 1.6 * $T), (15 + $dx) * $T, $y)
            }
            $p.Dispose()
        } elseif ($Motif -eq 'braises') {
            for ($k = 0; $k -lt 26; $k++) {
                $x = (2 + ($k * 37 % 12)) + $dx
                $y = 2 + ($k * 53 % 14)
                $r = (0.7 + ($k % 3) * 0.45) * $T
                $g.FillEllipse((New-Object System.Drawing.SolidBrush ([int]($accent))), ($x * $T - $r / 2), ($y * $T - $r / 2), $r, $r)
            }
        }
    }
    #  On reduit : c'est ce qui donne des bords propres.
    $petit = New-Object System.Drawing.Bitmap 64, 64, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g2 = [System.Drawing.Graphics]::FromImage($petit)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g2.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 0, 64, 64), (New-Object System.Drawing.Rectangle 0, 0, (64 * $T), (64 * $T)), [System.Drawing.GraphicsUnit]::Pixel)
    $g2.Dispose()
    $g.Dispose()
    $b.Dispose()

    $petit.Save($Fichier, [System.Drawing.Imaging.ImageFormat]::Png)
    $petit.Dispose()
    Write-Host ("  {0}" -f (Split-Path -Leaf $Fichier)) -ForegroundColor DarkGray
}

#  La cape de l auteur : violette, avec la croix et l etoile du logo.
DessinerCape -Fichier (Join-Path $sortie 'cape_xrn.png') `
    -Haut 'FF2A2050' -Bas 'FF140F28' -Accent 'FFC9B6FF' -Motif 'x'

#  Aurore : cyan, avec des vaguelettes de lumiere.
DessinerCape -Fichier (Join-Path $sortie 'cape_aurore.png') `
    -Haut 'FF0E4A5E' -Bas 'FF06202C' -Accent 'FF9DE8FF' -Motif 'vagues'

#  Braises : rouge sombre, avec des braises qui montent.
DessinerCape -Fichier (Join-Path $sortie 'cape_braises.png') `
    -Haut 'FF4A1A1E' -Bas 'FF1A0A0C' -Accent 'FFFF9A5A' -Motif 'braises'

#  Les ailes : meme mise en page que la cape, avec une forme d aile.
$aile = New-Object System.Drawing.Bitmap 64, 64, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ga = [System.Drawing.Graphics]::FromImage($aile)
$ga.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$ga.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ga.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$degradeA = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, 64, 64), 0xFF3A2E6E, 0xFF140F28, 90.0
$ga.FillRectangle($degradeA, (New-Object System.Drawing.Rectangle 0, 0, 64, 64))
$degradeA.Dispose()
$couleurAile = 0xFFB9A0FF
for ($f = 0; $f -lt 2; $f++) {
    $dx = $f * 11
    $pts = @(
        (New-Object System.Drawing.PointF (1 + $dx), 1),
        (New-Object System.Drawing.PointF (10 + $dx), 4),
        (New-Object System.Drawing.PointF (11 + $dx), 10),
        (New-Object System.Drawing.PointF (7 + $dx), 15),
        (New-Object System.Drawing.PointF (1 + $dx), 12)
    )
    if ($f -eq 1) { $pts = $pts | ForEach-Object { New-Object System.Drawing.PointF (11 - ($_.X - 12)), $_.Y } }
    $ga.FillPolygon((New-Object System.Drawing.SolidBrush $couleurAile), $pts)
    $pa = New-Object System.Drawing.Pen 0xFFE8E0FF, 0.6
    $ga.DrawLines($pa, $pts)
    $pa.Dispose()
}
$ga.Dispose()
$aile.Save((Join-Path $sortie 'ailes_xrn.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$aile.Dispose()
#  L etoile, pour les poussieres.
$e = New-Object System.Drawing.Bitmap 16, 16, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g3 = [System.Drawing.Graphics]::FromImage($e)
$g3.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g3.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$points = @()
for ($i = 0; $i -lt 8; $i++) {
    $a = $i * [Math]::PI / 4
    $r = if ($i % 2 -eq 0) { 7.0 } else { 3.0 }
    $points += (New-Object System.Drawing.PointF ([float](8 + [Math]::Cos($a) * $r)), ([float](8 + [Math]::Sin($a) * $r)))
}
$g3.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 233, 168))), $points)
$g3.Dispose()
$e.Save((Join-Path $sortie 'etoile_xrn.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$e.Dispose()

Write-Host ("  Textures des cosmetiques generee dans {0}" -f $sortie) -ForegroundColor Green
