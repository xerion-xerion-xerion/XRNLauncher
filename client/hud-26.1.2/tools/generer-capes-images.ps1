#Requires -Version 5.1
<#
    Les trois capes, a partir des images donnees par l auteur.

      cape_xrn      la planche de l auteur (le noir aux etoiles et au X)
      cape_aurore   la bleu glace (affichee "Cape Glacier")
      cape_braises  la comete dessinee (affichee "Cape Comete")

    Ce que le dos montre en jeu, c est le rectangle 10 x 16 en
    haut-gauche de la texture (u 1..11, v 1..17). TOUT se joue la :
    le dessin de chaque face prend TOUTE l image de l auteur
    comprimee dedans (le ratio 1:2 de la planche est le meme que
    celui de la face, rien ne se deforme). Le reste de la texture
    porte le meme motif, largest, pour les bords du modele.

    La vignette 128 de la garde-robe = EXACTEMENT la face du dos,
    elevee x8 en pixels bruts. Ce que l eventail affiche est ce que
    le jeu porte. Chevauche les deux images dans un salon : c est
    la meme.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$racine   = Split-Path -Parent $MyInvocation.MyCommand.Path
$textures = Join-Path $racine '..\src\main\resources\assets\xrnhud\textures'
$tele     = "$env:USERPROFILE\Downloads"

function Charger-Vive {
    #  Copie en memoire et referme le fichier tout de suite.
    param([string]$Chemin)
    $brute = New-Object System.Drawing.Bitmap $Chemin
    $clone = New-Object System.Drawing.Bitmap $brute.Width, $brute.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($clone)
    $g.DrawImage($brute, 0, 0, $brute.Width, $brute.Height)
    $g.Dispose()
    $brute.Dispose()
    return $clone
}

function Ecrire-Force {
    #  Ecrit le PNG, opacite forcee : aucun texel translucide.
    param([System.Drawing.Bitmap]$Image, [string]$Chemin)
    for ($y = 0; $y -lt $Image.Height; $y++) {
        for ($x = 0; $x -lt $Image.Width; $x++) {
            $c = $Image.GetPixel($x, $y)
            if ($c.A -lt 255) { $Image.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B)) }
        }
    }
    $Image.Save($Chemin, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Apercu-Fenetre {
    #  La vignette = la fenetre du dos (colonnes 4..44, rangees
    #  8..136), affichee A FOND DE CADRE, sans monture : les bandes
    #  de couleur moyenne se lisaient comme des defauts de contenu.
    #  L image remplit le carre entier, etiree comme une affiche.
    param([System.Drawing.Bitmap]$Peinture, [string]$Chemin)
    $v = New-Object System.Drawing.Bitmap 128, 128, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt 128; $y++) {
        $sy = 8 + [Math]::Min(127, $y)
        for ($x = 0; $x -lt 128; $x++) {
            $sx = 4 + [Math]::Min(39, [Math]::Floor($x * 40 / 128))
            $v.SetPixel($x, $y, $Peinture.GetPixel($sx, $sy))
        }
    }
    Ecrire-Force $v $Chemin
    $v.Dispose()
}

function Elevee-Brut {
    #  La texture 64 x 64, elevee x4 en brut : au jeu, la meme mise
    #  en page echantillonnee avec quatre fois plus de finesse, les
    #  blocs restent nets au lieu de se melanger en boue.
    param([System.Drawing.Bitmap]$Peinture)
    $t = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($t)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.DrawImage($Peinture, 0, 0, 256, 256)
    $g.Dispose()
    return $t
}

function Tamponne {
    #  Recopie en brut le motif source dans la cible : les pixels du
    #  motif restent exacts, sans interpolation.
    param([System.Drawing.Bitmap]$Cible, [System.Drawing.Bitmap]$Source,
          [int]$DestX, [int]$DestY, [int]$RectX, [int]$RectY, [int]$RectL, [int]$RectH)
    for ($y = 0; $y -lt $RectH; $y++) {
        for ($x = 0; $x -lt $RectL; $x++) {
            $s = $Source.GetPixel($RectX + $x, $RectY + $y)
            if ($s.A -lt 10) { continue }
            $dx = $DestX + $x; $dy = $DestY + $y
            if ($dx -ge 0 -and $dx -lt $Cible.Width -and $dy -ge 0 -and $dy -lt $Cible.Height) {
                $Cible.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb(255, $s.R, $s.G, $s.B))
            }
        }
    }
}

function Etire-Tampon {
    #  Tamponne le motif source en l etirant (ou le comprimant) aux
    #  dimensions de la zone cible. La planche 32 x 64 et la face
    #  10 x 16 ont le meme ratio 1:2 : l image de l auteur tient
    #  entiere dans la face, sans deformation.
    param([System.Drawing.Bitmap]$Cible, [System.Drawing.Bitmap]$Source,
          [int]$DestX, [int]$DestY, [int]$DestL, [int]$DestH,
          [int]$RectX, [int]$RectY, [int]$RectL, [int]$RectH)
    for ($y = 0; $y -lt $DestH; $y++) {
        for ($x = 0; $x -lt $DestL; $x++) {
            $sx = $RectX + [Math]::Min($RectL - 1, [Math]::Floor($x * $RectL / $DestL))
            $sy = $RectY + [Math]::Min($RectH - 1, [Math]::Floor($y * $RectH / $DestH))
            $s = $Source.GetPixel($sx, $sy)
            if ($s.A -lt 10) { continue }
            $Cible.SetPixel($DestX + $x, $DestY + $y, [System.Drawing.Color]::FromArgb(255, $s.R, $s.G, $s.B))
        }
    }
}

# --- cape xrn : la planche de l auteur, sa croix ecrite a l echelle ----
function Paint-xrn {
    $src = Charger-Vive (Join-Path $tele 'skinmc-cape (2).png')

    #  Les couleurs reels de la planche : le violet de la croix et la
    #  base sombre, relevees pixel par pixel (pas de rouge invente).
    $sommeV = 0.0; $sommeVv = 0.0; $sommeVz = 0.0; $pviolet = 0
    $sommeB = 0.0; $sommeBv = 0.0; $sommeBz = 0.0; $pbase = 0
    for ($y = 0; $y -lt $src.Height; $y++) {
        for ($x = 0; $x -lt $src.Width; $x++) {
            $c = $src.GetPixel($x, $y)
            if ($c.A -lt 10) { continue }
            if ($c.B -gt 110 -and $c.R -gt 30 -and $c.G -lt 100 -and ($c.B - $c.G) -gt 40) {
                $sommeV += $c.R; $sommeVv += $c.G; $sommeVz += $c.B; $pviolet++
            } elseif ($c.R -gt 200 -and $c.G -gt 200 -and $c.B -gt 200) {
                continue
            } else {
                $sommeB += $c.R; $sommeBv += $c.G; $sommeBz += $c.B; $pbase++
            }
        }
    }
    $base = [System.Drawing.Color]::FromArgb(255,
        [Math]::Floor($sommeB / $pbase), [Math]::Floor($sommeBv / $pbase), [Math]::Floor($sommeBz / $pbase))

    #  La texture 256 x 256 : le dos en jeu preleve les colonnes
    #  4..44 et les rangees 8..136 -- c est LA fenetre que la pose
    #  debout montre, rien d autre. La planche de l auteur s y pose
    #  en 32 x 128 (ratio 0,25 ; ramenee au dos 10 x 16, elle
    #  s affiche avec ses proportions exactes, pixel par pixel).
    #  Le grain sombre continue autour pour les faces laterales.
    $t = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt 256; $y++) {
        for ($x = 0; $x -lt 256; $x++) {
            $n = ((($x * 31) + ($y * 17)) % 13) - 6
            $t.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255,
                [Math]::Max(0, [Math]::Min(255, $base.R + $n)),
                [Math]::Max(0, [Math]::Min(255, $base.G + $n)),
                [Math]::Max(0, [Math]::Min(255, $base.B + $n))))
        }
    }
    Etire-Tampon $t $src 8 8 32 128 0 0 32 64

    Ecrire-Force $t (Join-Path $textures 'cape_xrn.png')
    Apercu-Fenetre $t (Join-Path $textures ('preview\cape_xrn.png'))
    $t.Dispose()
    $src.Dispose()
}

# --- cape aurore : le champ de glace, la face native -------------------
function Paint-aurore {
    $t = New-Object System.Drawing.Bitmap 64, 64, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    #  Le fond glacier : du bleu ciel au bleu d ombre.
    for ($y = 0; $y -lt 64; $y++) {
        $p = $y / 63
        for ($x = 0; $x -lt 64; $x++) {
            $r = [Math]::Floor(186 + (124 - 186) * $p)
            $v = [Math]::Floor(219 + (168 - 219) * $p)
            $z = [Math]::Floor(250 + (230 - 250) * $p)
            $pl = $x % 22
            if ($pl -ge 12 -and $pl -le 13) { $r -= 10; $v -= 10; $z -= 12 }
            elseif ($pl -ge 14 -and $pl -le 15) { $r += 6; $v += 6; $z += 6 }
            $n = (($x * 31 + $y * 17) % 13) - 6
            $t.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255,
                [Math]::Max(0, [Math]::Min(255, $r + $n)),
                [Math]::Max(0, [Math]::Min(255, $v + $n)),
                [Math]::Max(0, [Math]::Min(255, $z + $n))))
        }
    }

    #  Les stalactites : la glace en colonnes pendues du haut, un
    #  drap qui remonte du bas, des givretons entre les rangs.
    $blanc  = [System.Drawing.Color]::FromArgb(255, 244, 249, 255)
    $col    = [System.Drawing.Color]::FromArgb(255, 214, 234, 253)
    $ombre  = [System.Drawing.Color]::FromArgb(255, 148, 188, 238)
    $fonce  = [System.Drawing.Color]::FromArgb(255, 108, 152, 224)
    $gauche = 8941
    for ($x = 0; $x -lt 64; $x++) {
        $gauche = (([long]$gauche * 1103515245 + 12345) % 2147483648)
        #  Rideau a longueurs melees : la plupart des colonnes restent
        #  courtes, quelquesunes descendent profond -- le champ du
        #  milieu reste occupe sans creer de couture horizontale.
        $h1 = if ((($gauche / 256) % 32) -lt 18) { 6 + (($gauche / 256) % 12) } else { 18 + (($gauche / 256) % 14) }
        $gauche = (([long]$gauche * 1103515245 + 12345) % 2147483648)
        $h2 = 4 + (($gauche / 256) % 14)
        for ($y = 0; $y -lt $h1; $y++) {
            $p = [Math]::Min(1.0, $y / [Math]::Max(1.0, $h1 - 1.0))
            $c = if ($y -le 1) { $blanc } elseif ($p -lt 0.55) { $col } elseif ($p -lt 0.9) { $ombre } else { $fonce }
            #  La pointe reste claire : la glace s effile en blanc.
            if ($y -eq $h1 - 1) { $c = $blanc }
            $t.SetPixel($x, $y, $c)
        }
        for ($k = 0; $k -lt $h2; $k++) {
            $y = 63 - $k
            $p = [Math]::Min(1.0, $k / [Math]::Max(1.0, $h2 - 1.0))
            $c = if ($k -eq 0) { $blanc } elseif ($p -lt 0.6) { $col } else { $ombre }
            $t.SetPixel($x, $y, $c)
        }
    }
    #  Quelques givretons au milieu de la toile, entre les rangs.
    for ($i = 0; $i -lt 70; $i++) {
        $gauche = (([long]$gauche * 1103515245 + 12345) % 2147483648)
        $x = [Math]::Floor(($gauche / 256) % 64)
        $gauche = (([long]$gauche * 1103515245 + 12345) % 2147483648)
        $y = 16 + [Math]::Floor(($gauche / 256) % 40)
        if (($x % 22) -lt 12 -or ($x % 22) -gt 13) {
            $c = if (($i % 6) -eq 0) { $ombre } else { $col }
            $t.SetPixel($x, $y, $c)
        }
    }
    #  Un voile de lumiere en haut : la glace accroche le ciel.
    for ($y = 0; $y -lt 12; $y++) {
        for ($x = 0; $x -lt 64; $x++) {
            $c = $t.GetPixel($x, $y)
            $tour = [Math]::Floor(12 * (1 - $y / 12))
            $t.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, [Math]::Min(255, $c.R + $tour), [Math]::Min(255, $c.G + $tour), [Math]::Min(255, $c.B + $tour)))
        }
    }

    $grande = Elevee-Brut $t
    Ecrire-Force $grande (Join-Path $textures 'cape_aurore.png')
    Apercu-Fenetre $grande (Join-Path $textures ('preview\cape_aurore.png'))
    $t.Dispose()
    $grande.Dispose()
}

# --- cape comete : la comete DESSINEE, l art au lieu de la boue --------
function Paint-braises {
    #  La photo, portee, = une tranche floue de nebuleuse : atroce a
    #  toute taille, toute coupe. La fenetre du dos appelle une
    #  composition : une comete dessinee, calee au centre de la
    #  fenetre du dos, son ciel etoile continuant sur toute la cape.
    $t = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    #  Le ciel de nuit : du bleu-noir en haut vers du bleu dense.
    for ($y = 0; $y -lt 256; $y++) {
        $p = $y / 255
        $fr = [Math]::Floor(18 + 10 * $p)
        $fv = [Math]::Floor(20 + 12 * $p)
        $fb = [Math]::Floor(38 + 26 * $p)
        for ($x = 0; $x -lt 256; $x++) {
            $n = ((($x * 31) + ($y * 17)) % 9) - 4
            $t.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255,
                [Math]::Max(0, [Math]::Min(255, $fr + $n)),
                [Math]::Max(0, [Math]::Min(255, $fv + $n)),
                [Math]::Max(0, [Math]::Min(255, $fb + $n))))
        }
    }

    #  La queue : en deux couches, comme l onde d une vraie comete.
    #  La lueur : large et faible. Le fil : fin et brillant. La
    #  derive vers la gauche evite le "pilier".
    for ($y = 26; $y -lt 256; $y++) {
        $p = ($y - 26) / 229
        $cx = 24 - (5 * $p)          # le centre de la queue, derive
        $fr = 18 + (10 * ($y / 255))
        $fv = 20 + (12 * ($y / 255))
        $fb = 38 + (26 * ($y / 255))
        $chaud = [Math]::Max(0.0, 1 - $p)   # la puissance de l eclat
        #  La lueur : la demi-largeur 8 -> 4, l ajout faible.
        $mi = 8 - (4 * $p)
        $xg = [Math]::Max(0, [Math]::Ceiling($cx - $mi))
        $xd = [Math]::Min(255, [Math]::Floor($cx + $mi))
        for ($x = $xg; $x -le $xd; $x++) {
            $dx = [Math]::Abs($x - $cx) / [Math]::Max(1.0, $mi)
            $s = 1 - $dx
            $r = [Math]::Min(255, [Math]::Floor($fr + (80 * $s * $chaud)))
            $v = [Math]::Min(255, [Math]::Floor($fv + (60 * $s * $chaud)))
            $z = [Math]::Min(255, [Math]::Floor($fb + (70 * $s * $chaud)))
            $t.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $v, $z))
        }
        #  Le fil : la demi-largeur 2 -> 1, l ajout vif.
        $mic = 2 - (1.2 * $p)
        $xcg = [Math]::Max(0, [Math]::Ceiling($cx - $mic - 1))
        $xcd = [Math]::Min(255, [Math]::Floor($cx + $mic + 1))
        for ($x = $xcg; $x -le $xcd; $x++) {
            $dx = [Math]::Abs($x - $cx) / [Math]::Max(1.0, $mic)
            $s = [Math]::Max(0.0, 1 - $dx)
            $r = [Math]::Min(255, [Math]::Floor($fr + ((225 * $s + 20) * $chaud)))
            $v = [Math]::Min(255, [Math]::Floor($fv + ((165 * $s + 15) * $chaud)))
            $z = [Math]::Min(255, [Math]::Floor($fb + ((80 * $s + 30) * $chaud)))
            $t.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $v, $z))
        }
    }

    #  La tete : un coeur blanc-dore, un halo pale-bleu, posee au
    #  centre du haut du dos, ENTIERE dans la fenetre (le dos demarre
    #  a y = 8 : la tete descend pour ne pas se faire rogner).
    for ($dy = -9; $dy -le 9; $dy++) {
        for ($dx = -9; $dx -le 9; $dx++) {
            $d = [Math]::Sqrt($dx * $dx + $dy * $dy)
            if ($d -gt 9) { continue }
            $x = 24 + $dx; $y = 20 + $dy
            if ($x -lt 0 -or $x -gt 255 -or $y -lt 0 -or $y -gt 255) { continue }
            if ($d -le 3.5) { $c = [System.Drawing.Color]::FromArgb(255, 255, 246, 220) }
            elseif ($d -le 5.5) { $c = [System.Drawing.Color]::FromArgb(255, 250, 214, 150) }
            else { $c = [System.Drawing.Color]::FromArgb(255, 150, 190, 235) }
            $t.SetPixel($x, $y, $c)
        }
    }

    #  Les etoiles : eparses, epaisses d un pixel, hors de la lueur.
    $gra = 73856093
    for ($i = 0; $i -lt 150; $i++) {
        $gra = (([long]$gra * 1103515245 + 12345) % 2147483648)
        $x = [Math]::Floor(($gra / 256) % 256)
        $gra = (([long]$gra * 1103515245 + 12345) % 2147483648)
        $y = [Math]::Floor(($gra / 256) % 256)
        if ([Math]::Abs($x - 24) -le 15 -and $y -gt 28) { continue }
        if ($t.GetPixel($x, $y).B -gt 90) { continue }
        $gra = (([long]$gra * 1103515245 + 12345) % 2147483648)
        $lu = 160 + (($gra / 256) % 96)
        $t.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255,
            [Math]::Min(255, [Math]::Floor($lu * 0.9)),
            [Math]::Min(255, [Math]::Floor($lu * 0.95)),
            [Math]::Min(255, [Math]::Floor($lu))))
    }

    Ecrire-Force $t (Join-Path $textures 'cape_braises.png')
    #  L apercu = la fenetre que le dos preleve : la comete vue en
    #  pose debout, telle qu elle est portee.
    Apercu-Fenetre $t (Join-Path $textures ('preview\cape_braises.png'))
    $t.Dispose()
}

Paint-xrn
Paint-aurore
Paint-braises
Write-Host "Trois capes peintes : la face du dos, dans la texture comme dans l apercu." -ForegroundColor Green
