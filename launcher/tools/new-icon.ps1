#Requires -Version 5.1
<#
  Genere l'icone de l'application, identique au logo de la barre de
  titre et du site.

  Le logo d'origine est un SVG en ligne (index.html) pose sur un fond
  degrade. On le re-dessine ici a partir de la meme recette, en haute
  resolution : c'est la seule facon d'obtenir un icone net dans la barre
  des taches, dans un raccourci, ou dans l'explorateur.

  Depuis le rework 4.2.0, l'icone suit exactement la marque du hero :
  deux orbites fines, une croix violette et une etoile blanche, nette.
  L'ancien fond en degrade conique et le halo de la croix donnaient un
  rendu « image generee » : ils ont ete supprimes.

  Les couleurs viennent de style.css :
    fond       #1b1630 -> #100d1c, degrade diagonal tres sobre
    orbites    rgba(233,235,242,.28) et rgba(167,139,250,.45)
    croix      #a78bfa
    etoile     #f2e9ff

  Les couleurs sont stockees en entier, et non en tableau : PowerShell
  deballe un tableau passe en argument, ce qui casserait les fonctions
  de melange.
#>
[CmdletBinding()]
param(
  [string]$OutFile = (Join-Path $PSScriptRoot '..\assets\icon.png'),
  [int]$Size = 1024
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Lerp-Couleur([int]$a, [int]$b, [double]$t) {
  $t = [Math]::Max(0.0, [Math]::Min(1.0, $t))
  $ar = ($a -shr 16) -band 0xFF; $ag = ($a -shr 8) -band 0xFF; $ab = $a -band 0xFF
  $br = ($b -shr 16) -band 0xFF; $bg = ($b -shr 8) -band 0xFF; $bb = $b -band 0xFF
  $r = [int]($ar + ($br - $ar) * $t)
  $v = [int]($ag + ($bg - $ag) * $t)
  $w = [int]($ab + ($bb - $ab) * $t)
  return [System.Drawing.Color]::FromArgb(255, $r, $v, $w)
}

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

# --- echelle : le dessin est concu en 38 unites, comme le CSS ---------
$U = $Size / 38.0

$bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# --- fond : un degrade diagonal sombre, pas de degrade conique ---------
$coins = 12.0 * $U
$formeFond = Chemin-Arrondi 0 0 $Size $Size $coins
$degradeFond = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.PointF([float]($Size * 0.15), [float]($Size * 0.05))),
  (New-Object System.Drawing.PointF([float]($Size * 0.85), [float]($Size * 0.95))),
  [System.Drawing.Color]::FromArgb(255, 0x1B, 0x16, 0x30),
  [System.Drawing.Color]::FromArgb(255, 0x10, 0x0D, 0x1C))
$g.FillPath($degradeFond, $formeFond)
$degradeFond.Dispose()

# --- liseré violet, tres discret --------------------------------------
$liser = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(52, 0xA7, 0x8B, 0xFA), [single](0.42 * $U))
$g.DrawPath($liser, $formeFond)
$liser.Dispose()

# --- le SVG de la barre de titre, a l identique -----------------------
$cote = 32.0 * $U
$decalage = ($Size - $cote) / 2.0
$vue = $cote / 64.0

function Anneau([double]$rotation, [System.Drawing.Color]$couleur, [double]$largeur) {
  $mx = $decalage + 32 * $vue
  $my = $decalage + 32 * $vue
  $rx = 27.5 * $vue
  $ry = 11.0 * $vue
  $st = $g.Save()
  $g.TranslateTransform([float]$mx, [float]$my)
  $g.RotateTransform([float]$rotation)
  $pinceau = [System.Drawing.Pen]::new($couleur, [single]$largeur)
  $g.DrawEllipse($pinceau, [float](-$rx), [float](-$ry), [float]($rx * 2), [float]($ry * 2))
  $pinceau.Dispose()
  $g.Restore($st)
}
Anneau -22.0 ([System.Drawing.Color]::FromArgb(72, 0xE9, 0xEB, 0xF2)) (1.0 * $vue)
Anneau  38.0 ([System.Drawing.Color]::FromArgb(115, 0xA7, 0x8B, 0xFA)) (1.0 * $vue)

# --- la croix : violet plein, sans halo -------------------------------
$largeurCroix = 3.0 * $vue
$ax = $decalage + 19.5 * $vue; $ay = $decalage + 16.0 * $vue
$bx = $decalage + 44.5 * $vue; $by = $decalage + 48.0 * $vue
$cx2 = $decalage + 44.5 * $vue; $cy2 = $decalage + 16.0 * $vue
$dx2 = $decalage + 19.5 * $vue; $dy2 = $decalage + 48.0 * $vue

$croix = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 0xA7, 0x8B, 0xFA), [single]$largeurCroix)
$croix.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$croix.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($croix, [float]$ax, [float]$ay, [float]$bx, [float]$by)
$g.DrawLine($croix, [float]$cx2, [float]$cy2, [float]$dx2, [float]$dy2)
$croix.Dispose()

# --- l etoile : quatre branches fines, comme dans le hero et le site ---
$etoile = @(
  @(32.0, 24.5), @(33.7, 30.3), @(39.5, 32.0), @(33.7, 33.7),
  @(32.0, 39.5), @(30.3, 33.7), @(24.5, 32.0), @(30.3, 30.3)
)
$points = New-Object 'System.Drawing.PointF[]' $etoile.Count
for ($i = 0; $i -lt $etoile.Count; $i++) {
  $points[$i] = New-Object System.Drawing.PointF(
    [float]($decalage + $etoile[$i][0] * $vue),
    [float]($decalage + $etoile[$i][1] * $vue))
}
$remplissage = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0xF2, 0xE9, 0xFF))
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
