param([ValidateSet('Protect','Unprotect')][string]$Mode)
$ErrorActionPreference='Stop'
try {
 Add-Type -AssemblyName System.Security
 $payload=[Console]::In.ReadToEnd()
 $bytes=[Convert]::FromBase64String($payload)
 $entropy=[Text.Encoding]::UTF8.GetBytes('XRNLauncher:profiles:v1')
 $scope=[Security.Cryptography.DataProtectionScope]::CurrentUser
 if($Mode -eq 'Protect'){$result=[Security.Cryptography.ProtectedData]::Protect($bytes,$entropy,$scope)}
 else{$result=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$entropy,$scope)}
 [Console]::Out.Write([Convert]::ToBase64String($result))
} catch { [Console]::Error.Write('Windows session protection failed'); exit 1 }
