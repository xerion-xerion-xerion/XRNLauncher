#!/usr/bin/env python3
"""Reject stale or test installers before uploading a release."""
import argparse, hashlib, json, pathlib
P=pathlib.Path
ROOT=P(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb')as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def verify(directory, record_name='XRN-Setup-build.json'):
 directory=directory.resolve();r=json.loads((directory/record_name).read_text(encoding='utf-8'))
 assert not r['testBuild'],'A test installer must not be published'
 assert P(r['setupName']).name==r['setupName'] and P(r['payloadName']).name==r['payloadName'],'Invalid artifact filename'
 assert sha(directory/r['setupName'])==r['setupSha256'],'Setup changed after compilation'
 assert sha(directory/r['payloadName'])==r['payloadSha256'],'Setup and payload do not match'
 expected='https://github.com/xerion-xerion-xerion/XRNLauncher/releases/download/v'+r['appVersion']+'/XRNLauncher-win-x64.zip'
 assert r['payloadUrl']==expected,'Unexpected production download URL'
 for name,digest in r['sourceHashes'].items():assert sha(ROOT/'installer'/name)==digest,'Installer sources changed: '+name
 return r
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--directory',type=P,required=True);a.add_argument('--record',default='XRN-Setup-build.json');o=a.parse_args();r=verify(o.directory,o.record);print('PASS: production setup, payload, fixed URL and source fingerprints agree ('+r['appVersion']+').')
