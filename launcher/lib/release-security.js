'use strict';
function trustedUrl(value){
 const u=new URL(String(value));
 if(u.protocol!=='https:'||u.hostname!=='github.com'||u.port||u.username||u.password||u.search||u.hash||!/^\/xerion-xerion-xerion\/XRNLauncher\/releases\/download\/[^/]+\/XRNLauncher-(?:win-x64|patch|noyau)\.zip$/.test(u.pathname))throw new Error('Adresse de mise à jour non autorisée');
 return u.href;
}
function approvedAsset(value,assets){
 const url=trustedUrl(value),asset=(assets||[]).find(a=>a.browser_download_url===url);
 if(!asset)throw new Error('Cette archive ne fait pas partie de la release officielle courante');
 const digest=String(asset.digest||'');if(!/^sha256:[a-f0-9]{64}$/i.test(digest))throw new Error('La release ne fournit pas une empreinte SHA-256 vérifiable');
 return {url,sha256:digest.slice(7),size:Number(asset.size)||0};
}
module.exports={trustedUrl,approvedAsset};
