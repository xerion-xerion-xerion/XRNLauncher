#Requires -Version 5.1
<#
    Genere les miniatures des cosmetiques pour le menu de garde-robe.
    Au lieu de montrer la texture brute (des X), on cree des images
    stylees qui donnent envie.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$racine = Split-Path -Parent $MyInvocation.MyCommand.Path
$sortie = Join-Path $racine '..\src\main\resources\assets\xrnhud\textures\preview'
if (-not (Test-Path -LiteralPath $sortie)) { New-Item -ItemType Directory -Path $sortie -Force | Out-Null }

function Miniature {
    param([string]$Fichier, [int]$Couleur1, [int]$Couleur2, [string]$Type)
    
    $b = New-Object System.Drawing.Bitmap 128, 128, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Fond degrade
    $rect = New-Object System.Drawing.Rectangle 0, 0, 128, 128
    $degrade = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $Couleur1, $Couleur2, 45.0)
    $g.FillRectangle($degrade, $rect)
    $degrade.Dispose()
    
    # Effet selon le type
    if ($Type -eq 'cape') {
        # Une forme de cape stylisee
        $points = @(
            (New-Object System.Drawing.PointF 40, 30),
            (New-Object System.Drawing.PointF 88, 30),
            (New-Object System.Drawing.PointF 88, 95),
            (New-Object System.Drawing.PointF 64, 110),
            (New-Object System.Drawing.PointF 40, 95)
        )
        $g.FillPolygon((New-Object System.Drawing.SolidBrush 0x40FFFFFF), $points)
        $g.DrawPolygon((New-Object System.Drawing.Pen 0xFFFFFFFF, 2), $points)
    } elseif ($Type -eq 'ailes') {
        # Deux formes d ailes
        $pts1 = @(
            (New-Object System.Drawing.PointF 64, 40),
            (New-Object System.Drawing.PointF 40, 50),
            (New-Object System.Drawing.PointF 35, 70),
            (New-Object System.Drawing.PointF 50, 80),
            (New-Object System.Drawing.PointF 64, 75)
        )
        $pts2 = @(
            (New-Object System.Drawing.PointF 64, 40),
            (New-Object System.Drawing.PointF 88, 50),
            (New-Object System.Drawing.PointF 93, 70),
            (New-Object System.Drawing.PointF 78, 80),
            (New-Object System.Drawing.PointF 64, 75)
        )
        $g.FillPolygon((New-Object System.Drawing.SolidBrush 0x60FFFFFF), $pts1)
        $g.FillPolygon((New-Object System.Drawing.SolidBrush 0x60FFFFFF), $pts2)
    } elseif ($Type -eq 'particules') {
        # Des etoiles
        for ($i = 0; $i -lt 15; $i++) {
            $x = 20 + ($i * 23 % 88)
            $y = 20 + ($i * 37 % 88)
            $r = 3 + ($i % 3)
            $g.FillEllipse((New-Object System.Drawing.SolidBrush 0xFFFFFFFF), $x, $y, $r, $r)
        }
    }
    
    $g.Dispose()
    $b.Save($Fichier, [System.Drawing.Imaging.ImageFormat]::Png)
    $b.Dispose()
    Write-Host ("  {0}" -f (Split-Path -Leaf $Fichier)) -ForegroundColor DarkGray
}

Miniature -Fichier (Join-Path $sortie 'cape_xrn.png') -Couleur1 0xFF2A2050 -Couleur2 0xFF140F28 -Type 'cape'
Miniature -Fichier (Join-Path $sortie 'cape_aurore.png') -Couleur1 0xFF0E4A5E -Couleur2 0xFF06202C -Type 'cape'
Miniature -Fichier (Join-Path $sortie 'cape_braises.png') -Couleur1 0xFF4A1A1E -Couleur2 0xFF1A0A0C -Type 'cape'
Miniature -Fichier (Join-Path $sortie 'ailes_lumiere.png') -Couleur1 0xFF3A2E6E -Couleur2 0xFF140F28 -Type 'ailes'
Miniature -Fichier (Join-Path $sortie 'poussieres_etoiles.png') -Couleur1 0xFF2A2050 -Couleur2 0xFF140F28 -Type 'particules'

Write-Host ("Miniatures generees dans {0}" -f $sortie) -ForegroundColor Green

#  La signature : le X du logo, clair sur fond sombre.
$b2 = New-Object System.Drawing.Bitmap 128, 128, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g2 = [System.Drawing.Graphics]::FromImage($b2)
$g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$rect2 = New-Object System.Drawing.Rectangle 0, 0, 128, 128
$d2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect2, 0xFF241C48, 0xFF0E0A1C, 45.0)
$g2.FillRectangle($d2, $rect2)
$d2.Dispose()
$p2 = New-Object System.Drawing.Pen 0xFFC9B6FF, 12
$p2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$p2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g2.DrawLine($p2, 40, 34, 88, 94)
$g2.DrawLine($p2, 88, 34, 40, 94)
$p2.Dispose()
$br2 = New-Object System.Drawing.SolidBrush 0xFFFFE9A8
$g2.FillEllipse($br2, 56, 56, 16, 16)
$br2.Dispose()
$g2.Dispose()
$b2.Save((Join-Path $sortie 'signature_xrn.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$b2.Dispose()
