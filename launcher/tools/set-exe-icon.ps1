#Requires -Version 5.1
<#
  Applique une icone dans le fichier .exe (ressource PE) via les API Windows.
  Best-effort : si l'ecriture echoue, le build continue (l'icone de fenetre
  est deposee au demarrage par main.js -> barre des taches correcte).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Exe,
  [Parameter(Mandatory)][string]$Png
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -Namespace ExeRes -Name Native -MemberDefinition @'
[DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode, EntryPoint="BeginUpdateResourceW")]
public static extern System.IntPtr BeginUpdateResource(string file, bool deleteExisting);
[DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode, EntryPoint="UpdateResourceW")]
public static extern bool UpdateResource(System.IntPtr h, System.IntPtr type, System.IntPtr name, ushort lang, byte[] data, uint size);
[DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode, EntryPoint="EndUpdateResourceW")]
public static extern bool EndUpdateResource(System.IntPtr h, bool discard);
'@

function New-IcoBytes {
  param([string]$PngPath, [int[]]$Sizes)
  $src = [System.Drawing.Image]::FromFile($PngPath)
  $ms = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter($ms)
  $w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$Sizes.Count)
  $offset = 6 + (16 * $Sizes.Count)
  $blobs = @()
  foreach ($sz in $Sizes) {
    #  On redessine l icone a la taille voulue au lieu de reduire
    #  l image de depart : reduire casse les traits fins, et une
    #  icone de bureau finit en pointilles.
    $dessin = Join-Path $env:TEMP ("xrn-ico-" + $sz + ".png")
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'new-icon.ps1') -OutFile $dessin -Size $sz | Out-Null
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage([System.Drawing.Image]::FromFile($dessin), (New-Object System.Drawing.Rectangle(0, 0, $sz, $sz)))
    $g.Dispose()
    Remove-Item -LiteralPath $dessin -Force -ErrorAction SilentlyContinue
    $tmp = New-Object System.IO.MemoryStream
    $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $blobs += , $tmp.ToArray()
    $tmp.Dispose()
  }
  $src.Dispose()
  foreach ($b in $blobs) {
    $bw = if ($Sizes[$blobs.IndexOf($b)] -ge 256) { [byte]0 } else { [byte]$Sizes[$blobs.IndexOf($b)] }
    $w.Write($bw); $w.Write($bw); $w.Write([byte]0); $w.Write([byte]0)
    $w.Write([uint16]1); $w.Write([uint16]32)
    $w.Write([uint32]$b.Length); $w.Write([uint32]$offset)
    $offset += $b.Length
  }
  foreach ($b in $blobs) { $w.Write($b) }
  $w.Flush()
  $out = $ms.ToArray()
  $w.Close(); $ms.Dispose()
  return @{ Bytes = $out; Blobs = $blobs; Sizes = $Sizes }
}

try {
  if (-not (Test-Path -LiteralPath $Exe)) { throw "Exe introuvable" }
  if (-not (Test-Path -LiteralPath $Png)) { throw "PNG introuvable" }

  $sizes = @(16, 24, 32, 48, 64, 128, 256)
  $ico = New-IcoBytes -PngPath $Png -Sizes $sizes

  $h = [ExeRes.Native]::BeginUpdateResource($Exe, $false)
  if ($h -eq [IntPtr]::Zero) { throw "BeginUpdateResource a echoue" }

  # ecriture dans les deux langues (neutre + en-US)
  foreach ($lang in @(0, 1033)) {
    for ($i = 0; $i -lt $ico.Sizes.Count; $i++) {
      $data = $ico.Blobs[$i]
      [void][ExeRes.Native]::UpdateResource($h, [IntPtr]3, [IntPtr]($i + 1), [uint16]$lang, $data, [uint32]$data.Length)
    }
    # RT_GROUP_ICON : entete + une entrée par taille
    $gm = New-Object System.IO.MemoryStream
    $gw = New-Object System.IO.BinaryWriter($gm)
    $gw.Write([uint16]0); $gw.Write([uint16]1); $gw.Write([uint16]$ico.Sizes.Count)
    for ($i = 0; $i -lt $ico.Sizes.Count; $i++) {
      $bw = if ($ico.Sizes[$i] -ge 256) { [byte]0 } else { [byte]$ico.Sizes[$i] }
      $gw.Write($bw); $gw.Write($bw); $gw.Write([byte]0); $gw.Write([byte]0)
      $gw.Write([uint16]1); $gw.Write([uint16]32)
      $gw.Write([uint32]$ico.Blobs[$i].Length)
      $gw.Write([uint16]($i + 1))
    }
    $gw.Flush()
    $grp = $gm.ToArray(); $gw.Close(); $gm.Dispose()
    [void][ExeRes.Native]::UpdateResource($h, [IntPtr]14, [IntPtr]1, [uint16]$lang, $grp, [uint32]$grp.Length)
  }

  if (-not [ExeRes.Native]::EndUpdateResource($h, $false)) {
    [void][ExeRes.Native]::EndUpdateResource($h, $true)
    throw "EndUpdateResource a echoue"
  }
  Write-Host "Icone .exe appliquee ($($sizes.Count) tailles)" -ForegroundColor Green
} catch {
  Write-Host "[!] Icone du .exe non appliquee : $($_.Exception.Message)" -ForegroundColor Yellow
}