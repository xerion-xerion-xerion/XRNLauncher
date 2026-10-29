param(
  [Parameter(Mandatory=$true)][string]$FilePath,
  [Parameter(Mandatory=$true)][string]$CertificateThumbprint,
  [string]$SignTool='',
  [switch]$VerifyOnly
)
$ErrorActionPreference='Stop'
$wanted=($CertificateThumbprint -replace '\s','').ToUpperInvariant()
if($wanted -notmatch '^[A-F0-9]{40}$'){throw 'Une empreinte de certificat SHA-1 de 40 caracteres est requise.'}
$target=(Resolve-Path -LiteralPath $FilePath).Path
if([IO.Path]::GetExtension($target) -notin @('.exe','.dll')){throw 'La signature concerne uniquement un executable Windows.'}
if(-not $VerifyOnly){
  $certificate=$null;$machine=$false
  foreach($store in @('CurrentUser','LocalMachine')){
    $candidate=Get-Item -LiteralPath ('Cert:\'+$store+'\My\'+$wanted) -ErrorAction SilentlyContinue
    if($candidate){$certificate=$candidate;$machine=$store -eq 'LocalMachine';break}
  }
  if(-not $certificate){throw 'Certificat introuvable. Un certificat de signature de code reconnu doit etre fourni par son titulaire.'}
  if(-not $certificate.HasPrivateKey){throw 'La cle privee du certificat de signature est indisponible.'}
  if($certificate.Subject -eq $certificate.Issuer){throw 'Un certificat autosigne ne convient pas a une publication publique.'}
  if($certificate.NotBefore -gt (Get-Date) -or $certificate.NotAfter -lt (Get-Date)){throw 'Le certificat est expire ou pas encore valide.'}
  $codeSigning=$false
  foreach($extension in $certificate.Extensions){if($extension -is [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]){foreach($usage in $extension.EnhancedKeyUsages){if($usage.Value -eq '1.3.6.1.5.5.7.3.3'){$codeSigning=$true}}}}
  if(-not $codeSigning){throw 'Ce certificat ne permet pas la signature de code Authenticode (un certificat Office ne suffit pas).'}
  $chain=New-Object Security.Cryptography.X509Certificates.X509Chain
  try{if(-not $chain.Build($certificate)){throw 'La chaine du certificat ne peut pas etre validee par Windows.'}}finally{$chain.Dispose()}
  if(-not $SignTool){
    $sdk=Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
    if(Test-Path -LiteralPath $sdk){$SignTool=Get-ChildItem -LiteralPath $sdk -Filter signtool.exe -File -Recurse | Where-Object {$_.Directory.Name -eq 'x64'} | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName}
  }
  if(-not $SignTool){throw 'SignTool du SDK Windows est requis.'}
  $tool=(Resolve-Path -LiteralPath $SignTool).Path
  $toolSignature=Get-AuthenticodeSignature -LiteralPath $tool
  if($toolSignature.Status -ne 'Valid' -or $toolSignature.SignerCertificate.Subject -notmatch 'Microsoft'){throw 'La signature Microsoft de SignTool ne peut pas etre verifiee.'}
  $arguments=@('sign','/fd','SHA256','/sha1',$wanted,'/s','My','/tr','https://timestamp.digicert.com','/td','SHA256')
  if($machine){$arguments+='/sm'}
  & $tool @arguments $target
  if($LASTEXITCODE -ne 0){throw 'SignTool a refuse la signature ; la publication doit etre arretee.'}
}
$signature=Get-AuthenticodeSignature -LiteralPath $target
if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $wanted){throw 'La signature Authenticode finale est invalide ou son titulaire ne correspond pas.'}
if(-not $signature.TimeStamperCertificate){throw 'L horodatage de confiance est absent.'}
Write-Output ('Signature Authenticode et horodatage verifies : '+[IO.Path]::GetFileName($target))
