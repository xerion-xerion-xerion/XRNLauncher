"""Stage only public website files. Never stage launcher, accounts or service secrets."""
from pathlib import Path
import shutil
repo=Path(__file__).resolve().parents[2]
out=Path(__file__).resolve().parent/'site-static'
out.mkdir(exist_ok=True)
for name in ['index.html','style.css','site.js','conditions.html','confidentialite.html']:
    shutil.copy2(repo/name,out/name)
shutil.copytree(repo/'assets',out/'assets',dirs_exist_ok=True)
(out/'_headers').write_text('/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n',encoding='utf-8')
print('Public website staged; no launcher or personal data included.')
