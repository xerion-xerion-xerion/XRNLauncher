#!/usr/bin/env python3
"""Build XRN release archives and the small Inno Setup downloader. No credentials required."""
import argparse,hashlib,json,pathlib,re,shutil,subprocess,tempfile,zipfile
P=pathlib.Path
ROOT=P(__file__).resolve().parents[1]
APP=ROOT/'launcher'
RUNTIME_SUFFIXES={'.dll','.pak','.bin'}
RUNTIME_NAMES={'XRNLauncher.exe','notification_helper.exe','icudtl.dat','vk_swiftshader_icd.json'}
TOOLS={'appliquer-maj.ps1','media-session.ps1','XrnMedia.exe','rename-window.ps1'}
DIRS={'lib','assets','mods-integres','legal'}
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def managed(folder):
 result={}
 for p in folder.rglob('*'):
  if not p.is_file():continue
  rel=p.relative_to(folder);name=rel.as_posix()
  if p.name in {'profiles.json','config.local.json','manifest.json'}:continue
  if len(rel.parts)==1 and (p.suffix in {'.js','.css','.html','.json'} or p.name in {'XRNLauncher.exe','LICENSE-NWJS.txt'}):result[name]=p
  elif rel.parts[0] in DIRS or (len(rel.parts)>1 and rel.parts[0]=='tools' and p.name in TOOLS):result[name]=p
 return result
def archive(path,files,prefix):
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,p in sorted(files.items()):z.write(p,prefix+name)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--runtime',type=P,required=True);ap.add_argument('--runtime-version',required=True);ap.add_argument('--previous',type=P);ap.add_argument('--output',type=P,default=ROOT/'dist');ap.add_argument('--iscc',type=P);args=ap.parse_args()
 version=json.loads((APP/'package.json').read_text(encoding='utf-8'))['version'];assert re.fullmatch(r'\d+\.\d+\.\d+',version)
 runtime=args.runtime.resolve();assert (runtime/'nw.dll').is_file() and (runtime/'XRNLauncher.exe').is_file(),'Provide a complete XRN runtime folder'
 out=args.output.resolve();out.mkdir(parents=True,exist_ok=True)
 temp=tempfile.TemporaryDirectory(prefix='xrn-release-');work=P(temp.name).resolve();assert work.parent==P(tempfile.gettempdir()).resolve() and work.name.startswith('xrn-release-')
 try:
  stage=work/'XRNLauncher';stage.mkdir()
  for p in runtime.iterdir():
   if p.is_file() and (p.suffix in RUNTIME_SUFFIXES or p.name in RUNTIME_NAMES):shutil.copy2(p,stage/p.name)
  for name in ['locales','Dictionaries']:
   if (runtime/name).is_dir():shutil.copytree(runtime/name,stage/name)
  for p in APP.iterdir():
   if p.is_file() and p.suffix in {'.js','.css','.html','.json'} and not p.name.startswith('_') and p.name not in {'profiles.json','config.local.json'}:shutil.copy2(p,stage/p.name)
  for name in DIRS:shutil.copytree(APP/name,stage/name)
  (stage/'tools').mkdir()
  for name in TOOLS:shutil.copy2(APP/'tools'/name,stage/'tools'/name)
  shutil.copy2(APP/'legal/LICENSE-NWJS.txt',stage/'LICENSE-NWJS.txt')
  full={p.relative_to(stage).as_posix():p for p in stage.rglob('*')if p.is_file()};new=managed(stage)
  archive(out/'XRNLauncher-win-x64.zip',full,'XRNLauncher/')
  archive(out/'XRNLauncher-noyau.zip',new,'XRNLauncher/')
  old=managed(args.previous.resolve()) if args.previous else {}
  changed=sorted(n for n,p in new.items() if n not in old or digest(p)!=digest(old[n]));removed=sorted(set(old)-set(new))
  manifest={'version':version,'runtime':args.runtime_version,'fichiers':[{'chemin':n,'taille':p.stat().st_size,'sha256':digest(p)}for n,p in sorted(new.items())if n!='XRNLauncher.exe'],'exe':{'taille':new['XRNLauncher.exe'].stat().st_size,'sha256':digest(new['XRNLauncher.exe'])}}
  if old:
   previous=json.loads((args.previous/'package.json').read_text(encoding='utf-8'))['version'];assert previous!=version,'Previous version must differ'
   manifest.update({'versionPrecedente':previous,'runtimePrecedent':args.runtime_version,'exePrecedent':digest(old['XRNLauncher.exe']),'precedents':{n:digest(p)for n,p in old.items()if n!='XRNLauncher.exe'},'modifies':changed,'supprimes':removed})
   archive(out/'XRNLauncher-patch.zip',{n:new[n]for n in changed},'patch/')
   with zipfile.ZipFile(out/'XRNLauncher-patch.zip','a',zipfile.ZIP_DEFLATED)as z:z.writestr('patch/_supprimes.txt','\n'.join(removed))
  (out/'XRNLauncher-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
  payload=out/'XRNLauncher-win-x64.zip';unpacked=sum(p.stat().st_size for p in full.values());sha=digest(payload)
  (ROOT/'installer/payload.iss').write_text('#define PayloadHash "'+sha+'"\n#define PayloadBytes '+str(unpacked)+'\n',encoding='utf-8')
  iss=ROOT/'installer/XRN-Setup.iss';script=iss.read_text(encoding='utf-8-sig');script=re.sub(r'#define AppVersion "[^"]+"','#define AppVersion "'+version+'"',script,count=1);iss.write_text(script,encoding='utf-8-sig')
  if args.iscc:subprocess.run([str(args.iscc.resolve()),'/DOutputFolder='+str(out),str(iss)],check=True)
  files=[p for p in out.iterdir()if p.is_file() and (p.name.startswith('XRNLauncher-') or p.name=='XRN-Setup.exe')]
  (out/'SHA256SUMS.txt').write_text(''.join(digest(p)+'  '+p.name+'\n'for p in sorted(files)),encoding='ascii')
  print(json.dumps({'version':version,'fullBytes':payload.stat().st_size,'patchBytes':(out/'XRNLauncher-patch.zip').stat().st_size if old else None,'setupBytes':(out/'XRN-Setup.exe').stat().st_size if (out/'XRN-Setup.exe').exists()else None,'filesChanged':len(changed),'filesRemoved':len(removed)}))
 finally:temp.cleanup()
if __name__=='__main__':main()
