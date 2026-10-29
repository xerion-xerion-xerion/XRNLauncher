Add-Type -AssemblyName System.Drawing

$dest = $args[0]
New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null

# Les memes couleurs que la barre de titre du launcher.
$V = [System.Drawing.Color]::FromArgb(255, 0xA7, 0x8B, 0xFA)   # violet
$D = [System.Drawing.Color]::FromArgb(255, 0x14, 0x0B, 0x2C)   # interieur sombre
$W = [System.Drawing.Color]::FromArgb(255, 0xF2, 0xE9, 0xFF)   # etoile blanche

# Le logo du launcher, en 8 pixels : le carre violet a bord, l interieur
# sombre, et l etoile a quatre branches au centre.
$motif = @(
  'VVVVVVVV',
  'VDDDDDDV',
  'VDDWWDDV',
  'VDWWWWWD',
  'VDWWWWWD',
  'VDDWWDDV',
  'VDDDDDDV',
  'VVVVVVVV'
)

$bmp = New-Object System.Drawing.Bitmap(8, 8, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt 8; $y++) {
  for ($x = 0; $x -lt 8; $x++) {
    $c = switch ($motif[$y][$x]) {
      'V' { $V }
      'W' { $W }
      default { $D }
    }
    $bmp.SetPixel($x, $y, $c)
  }
}
$bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host ("Texture du logo generee : " + $dest) -ForegroundColor Green
