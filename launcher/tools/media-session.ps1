param(
  [string]$Fichier = '',
  [string]$Pochette = '',
  [int]$Intervalle = 1000
)

#  Detecte la musique en cours de lecture.
#
#  Windows expose une API unique, le System Media Transport Controls :
#  Spotify, Deezer, et tout autre lecteur qui s'y declare passent par
#  la. On interroge donc la liste des sessions, et on garde celle qui
#  joue vraiment.
#
#  Le resultat est ecrit dans un fichier JSON, que le mod lit ensuite.
#  Un fichier et non un port ouvert : le jeu n a ainsi rien a
#  demarrer, et rien ne tourne quand le jeu est ferme.

$ErrorActionPreference = 'SilentlyContinue'

if (-not $Fichier) { $Fichier = Join-Path $env:APPDATA 'XRNLauncher\media.json' }
if (-not $Pochette) { $Pochette = Join-Path $env:APPDATA 'XRNLauncher\media.png' }

try { Add-Type -AssemblyName System.Runtime.WindowsRuntime } catch { }
try { Add-Type -AssemblyName System.Drawing } catch { }

#  Les methodes WinRT qui renvoient une valeur sont asynchrones. On a
#  besoin d une maniere de les attendre : cette reflexion trouve la
#  bonne surcharge de AsTask, celle qui prend un IAsyncOperation.
$trame = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Attendre($operation, $type) {
  $methode = $trame.MakeGenericMethod($type)
  $tache = $methode.Invoke($null, @($operation))
  [void]$tache.Wait(-1)
  $tache.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType=WindowsRuntime] | Out-Null
$manager = Attendre ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
  ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

$typeMedias = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$typeFlux = [Windows.Storage.Streams.IRandomAccessStream]

function EcrirePochette($medias) {
  try {
    if (-not $medias.Thumbnail) { return $false }
    $reference = $medias.Thumbnail
    $fluxWinRt = Attendre ($reference.OpenReadAsync()) $typeFlux
    $flux = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($fluxWinRt)
    $image = [System.Drawing.Image]::FromStream($flux)
    $image.Save($Pochette, [System.Drawing.Imaging.ImageFormat]::Png)
    $image.Dispose()
    $flux.Dispose()
    return $true
  } catch {
    return $false
  }
}

$dernier = ''

while ($true) {
  $choisi = $null
  try {
    $sessions = $manager.GetSessions()
    foreach ($session in $sessions) {
      $info = $session.GetPlaybackInfo()
      $etat = [string]$info.PlaybackStatus
      if ($etat -eq 'Playing' -or $etat -eq 'Paused') { $choisi = $session; break }
    }
    if (-not $choisi -and $sessions.Count -gt 0) { $choisi = $sessions[0] }
  } catch { }

  if ($choisi) {
    try {
      $medias = Attendre ($choisi.TryGetMediaPropertiesAsync()) $typeMedias
      $info = $choisi.GetPlaybackInfo()
      $chronologie = $choisi.GetTimelineProperties()

      $position = [int64]$chronologie.Position.TotalMilliseconds
      $restant = [int64]($chronologie.EndTime - $chronologie.StartTime).TotalMilliseconds
      if ($restant -lt 0) { $restant = 0 }
      $duree = $position + $restant

      $application = [string]$choisi.SourceAppUserModelId
      if ($application -like '*.exe') { $application = $application -replace '\.exe$', '' }

      $cle = "$($medias.Title)|$($medias.Artist)|$([string]$info.PlaybackStatus)|$position|$duree"
      if ($cle -ne $dernier) {
        $dernier = $cle
        $avecPochette = EcrirePochette $medias
        $objet = [ordered]@{
          titre = [string]$medias.Title
          artiste = [string]$medias.Artist
          album = [string]$medias.AlbumTitle
          application = $application
          etat = [string]$info.PlaybackStatus
          position = $position
          duree = $duree
          pochette = $(if ($avecPochette) { $Pochette } else { '' })
        }
        $json = $objet | ConvertTo-Json -Compress
        [IO.File]::WriteAllText($Fichier, $json, (New-Object Text.UTF8Encoding $false))
      }
    } catch { }
  } elseif ($dernier -ne '') {
    $dernier = ''
    [IO.File]::WriteAllText($Fichier, '{"titre":"","etat":"stopped"}', (New-Object Text.UTF8Encoding $false))
  }

  Start-Sleep -Milliseconds $Intervalle
}
