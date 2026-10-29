#!/usr/bin/env python3
"""Compile from an isolated source tree and derive the payload hash immediately before ISCC."""
import argparse, hashlib, json, pathlib, re, shutil, subprocess, tempfile, zipfile
P=pathlib.Path
ROOT=P(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--payload',type=P,required=True);ap.add_argument('--iscc',type=P,required=True);ap.add_argument('--output',type=P,required=True);ap.add_argument('--revision',default='1');ap.add_argument('--name',default='XRN-Setup');ap.add_argument('--test-build',action='store_true');ap.add_argument('--test-url');ap.add_argument("--sign-cert-thumbprint");ap.add_argument("--signtool",type=P);a=ap.parse_args()
 if a.signtool and not a.sign_cert_thumbprint:raise ValueError("--signtool requires --sign-cert-thumbprint")
 if not re.fullmatch(r'[A-Za-z0-9_.-]+',a.name) or not a.revision.isdigit():raise ValueError('Invalid installer name or revision')
 if a.test_url and not a.test_build:raise ValueError('A URL override is allowed only in an isolated test build')
 version=json.loads((ROOT/'launcher/package.json').read_text(encoding='utf-8'))['version']
 payload=a.payload.resolve();out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
 expected=sha(payload)
 with zipfile.ZipFile(payload) as z:
  if z.testzip() is not None:raise ValueError('Corrupt payload archive')
  if 'XRNLauncher/XRNLauncher.exe' not in z.namelist():raise ValueError('Missing launcher')
  unpacked=sum(i.file_size for i in z.infolist())
 source=ROOT/'installer';inputs={name:sha(source/name)for name in ['XRN-Setup.iss','conditions.rtf','confidentialite.rtf','setup.ico','wizard.bmp','wizard-small.bmp']}
 with tempfile.TemporaryDirectory(prefix='xrn-setup-build-') as temp:
  folder=P(temp).resolve();assert folder.parent==P(tempfile.gettempdir()).resolve() and folder.name.startswith('xrn-setup-build-')
  for name in inputs:shutil.copy2(source/name,folder/name)
  script=folder/'XRN-Setup.iss';text=script.read_text(encoding='utf-8-sig');text=re.sub(r'#define AppVersion "[^"]+"','#define AppVersion "'+version+'"',text,count=1);script.write_text(text,encoding='utf-8-sig')
  (folder/'payload.iss').write_text('#define PayloadHash "'+expected+'"\n#define PayloadBytes '+str(unpacked)+'\n',encoding='ascii')
  args=[str(a.iscc.resolve()),'/DOutputFolder='+str(out),'/DSetupRevision='+a.revision,'/DSetupBaseName='+a.name]
  if a.test_build:args.append('/DTestBuild')
  if a.test_url:args.append('/DPayloadUrl='+a.test_url)
  subprocess.run(args+[str(script)],check=True)
  if sha(payload)!=expected:raise ValueError('Payload changed during compilation')
 name='XRN-Setup-Test' if a.test_build else a.name;exe=out/(name+'.exe')
 if a.sign_cert_thumbprint:
  signing=['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(ROOT/'scripts/sign-windows.ps1'),'-FilePath',str(exe),'-CertificateThumbprint',a.sign_cert_thumbprint]
  if a.signtool:signing+=['-SignTool',str(a.signtool.resolve())]
  subprocess.run(signing,check=True)
 record={'appVersion':version,'setupRevision':int(a.revision),'testBuild':a.test_build,'payloadName':payload.name,'payloadSha256':expected,'payloadBytes':payload.stat().st_size,'payloadUrl':a.test_url or 'https://github.com/xerion-xerion-xerion/XRNLauncher/releases/download/v'+version+'/XRNLauncher-win-x64.zip','setupName':exe.name,'setupSha256':sha(exe),'setupBytes':exe.stat().st_size,'sourceHashes':inputs}
 if a.sign_cert_thumbprint:record['authenticodeThumbprint']=a.sign_cert_thumbprint.replace(' ','').upper()
 (out/(name+'-build.json')).write_text(json.dumps(record,indent=2),encoding='utf-8')
 print(json.dumps(record))
if __name__=='__main__':main()
