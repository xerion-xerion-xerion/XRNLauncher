<#
    rename-window : impose un titre a la fenetre du jeu.

    Minecraft construit son titre lui-meme ("Minecraft 1.21.11") et
    n'expose aucun argument pour le changer : "--title" n'existe meme
    pas dans les arguments des versions modernes. La seule facon d'y
    toucher est donc de renommer la fenetre depuis Windows.

    La fenetre met plusieurs secondes a apparaitre, et le jeu peut
    reafficher son titre apres coup. On cherche donc en boucle, puis on
    surveille encore quelques instants pour verifier que le titre tient.

    Attention : $PID est une constante de PowerShell (le processus
    courant). La variable locale du numero de processus s'appelle donc
    autrement, sous peine d'echouer silencieusement.
#>
param(
    [Parameter(Mandatory = $true)][int]$Cible,
    [string]$Title = 'XRNLauncher',
    [int]$Seconds = 40
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class XrnWin {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool SetWindowTextW(IntPtr hWnd, string text);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool GetWindowTextW(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

function Get-Fenetres {
    param([int]$Processus)

    $liste = New-Object System.Collections.ArrayList

    $callback = [XrnWin+EnumWindowsProc] {
        param([IntPtr]$h, [IntPtr]$l)
        $numero = [uint32]0
        [void][XrnWin]::GetWindowThreadProcessId($h, [ref]$numero)
        if ($numero -eq $Processus -and [XrnWin]::IsWindowVisible($h)) {
            $sb = New-Object System.Text.StringBuilder 512
            [void][XrnWin]::GetWindowTextW($h, $sb, 512)
            $t = $sb.ToString()
            if ($t) { [void]$liste.Add(@{ H = $h; Titre = $t }) }
        }
        return $true
    }

    [void][XrnWin]::EnumWindows($callback, [IntPtr]::Zero)
    return , $liste
}

$limite = (Get-Date).AddSeconds($Seconds)
$surveillance = $null
$renommees = 0

while ((Get-Date) -lt $limite) {
    foreach ($f in (Get-Fenetres $Cible)) {
        if ($f.Titre -ne $Title) {
            [void][XrnWin]::SetWindowTextW($f.H, $Title)
            $renommees++
            Write-Output "  [$Cible] '$($f.Titre)' -> '$Title'"
        }
    }

    if ($renommees -gt 0) {
        # Fenetre trouvee : on surveille encore quelques secondes, car le
        # jeu peut remettre son titre apres coup.
        if (-not $surveillance) { $surveillance = (Get-Date).AddSeconds(7) }
        if ((Get-Date) -gt $surveillance) { break }
    }
    Start-Sleep -Milliseconds 400
}

if ($renommees -eq 0) {
    Write-Output "  [$Cible] aucune fenetre visible trouvee"
} else {
    Write-Output "  [$Cible] $renommees renommage(s) - titre final : '$Title'"
}