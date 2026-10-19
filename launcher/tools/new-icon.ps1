#Requires -Version 5.1
<#
  Genere l'icone de l'application, identique au logo de la barre de titre.

  Le logo d'origine est un SVG en ligne (index.html) pose sur un fond
  degrade. On le re-dessine ici a partir de la meme recette, en haute
  resolution : c'est la seule facon d'obtenir un icone net dans la barre
  des taches, dans un raccourci, ou dans l'explorateur.

  Les couleurs viennent de style.css :
    fond       conic-gradient(from 200deg, #a78bfa #7c3aed #c026d3 #5b21b6)
    interieur  linear-gradient(160deg, #140b2c, #06040f)
    anneaux    rgba(232,121,249,.55) et rgba(167,139,250,.38)
    croix      degrade #a78bfa -> #7c3aed -> #d946ef
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

# --- palette, dans l ordre du CSS -------------------------------------
$CONIC = @(0xA78BFA, 0x7C3AED, 0xC026D3, 0x5B21B6, 0xA78BFA)
$GRAD_X = @(0xA78BFA, 0x7C3AED, 0xD946EF)

function Lerp-Couleur([int]$a, [int]$b, [double]$t) {
  $t = [Math]::Max(0.0, [Math]::Min(1.0, $t))
  $ar = ($a -shr 16) -band 0xFF; $ag = ($a -shr 8) -band 0xFF; $ab = $a -band 0xFF
  $br = ($b -shr 16) -band 0xFF; $bg = ($b -shr 8) -band 0xFF; $bb = $b -band 0xFF
  $r = [int]($ar + ($br - $ar) * $t)
  $v = [int]($ag + ($bg - $ag) * $t)
  $w = [int]($ab + ($bb - $ab) * $t)
  return [System.Drawing.Color]::FromArgb(255, $r, $v, $w)
}

function Conic-Couleur([double]$t) {
  $t = $t - [Math]::Floor($t)
  $n = $CONIC.Count - 1
  $i = [int][Math]::Floor($t * $n)
  if ($i -ge $n) { $i = $n - 1 }
  return Lerp-Couleur $CONIC[$i] $CONIC[$i + 1] (($t * $n) - $i)
}

function Degrade-Couleur([double]$t) {
  $t = [Math]::Max(0.0, [Math]::Min(1.0, $t))
  if ($t -lt 0.5) { return Lerp-Couleur $GRAD_X[0] $GRAD_X[1] ($t / 0.5) }
  return Lerp-Couleur $GRAD_X[1] $GRAD_X[2] (($t - 0.5) / 0.5)
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

# --- fond conique : fines tranches, comme un degrade angulaire --------
$coins = 12.0 * $U
$formeFond = Chemin-Arrondi 0 0 $Size $Size $coins
$etat = $g.Save()
$g.SetClip($formeFond)
$cx = $Size / 2.0
$cy = $Size / 2.0
$tranches = 720
for ($i = 0; $i -lt $tranches; $i++) {
  # Le CSS demarre a 200 degres, sens horaire, zero en haut.
  $a0 = 200.0 + (360.0 * $i / $tranches) - 90.0
  $a1 = 200.0 + (360.0 * ($i + 1) / $tranches) - 90.0
  $pinceau = New-Object System.Drawing.SolidBrush (Conic-Couleur ($i / [double]$tranches))
  $g.FillPie($pinceau, [float]($cx - $Size), [float]($cy - $Size),
             [float]($Size * 2), [float]($Size * 2), [float]$a0, [float]($a1 - $a0))
  $pinceau.Dispose()
}
$g.Restore($etat)

# --- interieur sombre, en retrait -------------------------------------
$repli = 2.5 * $U
$formeInt = Chemin-Arrondi $repli $repli ($Size - 2 * $repli) ($Size - 2 * $repli) (10.0 * $U)
$dx = [Math]::Sin(160.0 * [Math]::PI / 180.0)
$dy = -[Math]::Cos(160.0 * [Math]::PI / 180.0)
$demi = $Size / 2.0
$degrade = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.PointF([float]($demi - $dx * $demi), [float]($demi - $dy * $demi))),
  (New-Object System.Drawing.PointF([float]($demi + $dx * $demi), [float]($demi + $dy * $demi))),
  [System.Drawing.Color]::FromArgb(255, 0x14, 0x0B, 0x2C),
  [System.Drawing.Color]::FromArgb(255, 0x06, 0x04, 0x0F))
$g.FillPath($degrade, $formeInt)
$degrade.Dispose()

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
Anneau -22.0 ([System.Drawing.Color]::FromArgb(140, 0xE8, 0x79, 0xF9)) (1.6 * $vue)
Anneau  38.0 ([System.Drawing.Color]::FromArgb(97,  0xA7, 0x8B, 0xFA)) (1.6 * $vue)

# La croix : decoupee en segments pour porter le degrade diagonal.
# Le halo est dessine d un seul trait par branche : des segments
# semi-transparents qui se chevauchent s accumulent et font des taches.
$largeurCroix = 4.4 * $vue
$ax = $decalage + 19.5 * $vue; $ay = $decalage + 16.0 * $vue
$bx = $decalage + 44.5 * $vue; $by = $decalage + 48.0 * $vue
$cx2 = $decalage + 44.5 * $vue; $cy2 = $decalage + 16.0 * $vue
$dx2 = $decalage + 19.5 * $vue; $dy2 = $decalage + 48.0 * $vue
$branches = @(@($ax, $ay, $bx, $by), @($cx2, $cy2, $dx2, $dy2))

# Halo : trois passes concentriques, de faible opacite. Une seule passe
# dessinerait une bande nette autour du trait, pas un halo.
foreach ($pass in 0, 1) {
  $facteur = 1.3 + 0.35 * $pass
  $opacite = 26 - 9 * $pass
  $halo = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($opacite, 0xA7, 0x8B, 0xFA), [single]($largeurCroix * $facteur))
  $halo.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $halo.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  foreach ($ligne in $branches) {
    $g.DrawLine($halo, [float]$ligne[0], [float]$ligne[1], [float]$ligne[2], [float]$ligne[3])
  }
  $halo.Dispose()
}

# Trait : le degrade est applique segment par segment, a opacite pleine,
# pour que les raccords ne laissent aucune trace.
$segments = 96
foreach ($ligne in $branches) {
  $x0 = $ligne[0]; $y0 = $ligne[1]; $x1 = $ligne[2]; $y1 = $ligne[3]
  for ($i = 0; $i -lt $segments; $i++) {
    $t0 = $i / [double]$segments
    $t1 = ($i + 1) / [double]$segments
    $tm = ($t0 + $t1) / 2
    $mx = $x0 + ($x1 - $x0) * $tm
    $my = $y0 + ($y1 - $y0) * $tm
    # Position dans le degrade diagonal du cadre de la croix.
    $u = ($mx - $ax) / ($bx - $ax)
    $v = ($my - $ay) / ($by - $ay)
    $couleur = Degrade-Couleur ([Math]::Max(0.0, [Math]::Min(1.0, ($u + $v) / 2.0)))
    $pinceau = [System.Drawing.Pen]::new($couleur, [single]$largeurCroix)
    $pinceau.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pinceau.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($pinceau,
      [float]($x0 + ($x1 - $x0) * $t0), [float]($y0 + ($y1 - $y0) * $t0),
      [float]($x0 + ($x1 - $x0) * $t1), [float]($y0 + ($y1 - $y0) * $t1))
    $pinceau.Dispose()
  }
}

# L etoile a quatre branches, avec son halo.
$pts = New-Object System.Drawing.PointF[] 8
$coinsEtoile = @(@(32,20.5), @(34.9,29.1), @(43.5,32), @(34.9,34.9),
                  @(32,43.5), @(29.1,34.9), @(20.5,32), @(29.1,29.1))
for ($i = 0; $i -lt 8; $i++) {
  $pts[$i] = New-Object System.Drawing.PointF(
    [float]($decalage + $coinsEtoile[$i][0] * $vue),
    [float]($decalage + $coinsEtoile[$i][1] * $vue))
}
for ($halo = 3; $halo -ge 1; $halo--) {
  $t = $halo / 3.0
  $couleur = [System.Drawing.Color]::FromArgb([int](14 + 46 * (1 - $t)), 0xC7, 0xA0, 0xFF)
  $pinceau = New-Object System.Drawing.SolidBrush $couleur
  $g.FillPolygon($pinceau, $pts)
  $pinceau.Dispose()
}
$pinceau = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0xF2, 0xE9, 0xFF))
$g.FillPolygon($pinceau, $pts)
$pinceau.Dispose()

$g.Dispose()

$dir = Split-Path -Parent $OutFile
if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("Icone generee : " + $OutFile + " (" + $Size + "x" + $Size + ")") -ForegroundColor Green
