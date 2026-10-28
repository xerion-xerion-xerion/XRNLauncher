'use strict';
const crypto=require('crypto'),http=require('./http');
let cached=null;
const der=pem=>Buffer.from(String(pem).replace(/-----[^-]+-----/g,'').replace(/\s/g,''),'base64');
async function make(account,challenge,root){
 const uuid=String(account.id||'').replace(/-/g,'').toLowerCase(),audience=new URL(root).origin;
 if(!/^[a-f0-9]{32}$/.test(uuid)||!/^[a-f0-9]{40}$/.test(challenge.id||'')||challenge.audience!==audience||challenge.scheme!=='certificate-v2')throw Error('Challenge de présence invalide.');
 if(!cached||cached.uuid!==uuid||cached.until<Date.now()+60000){
  const r=await http.postJSON('https://api.minecraftservices.com/player/certificates',{}, {Authorization:'Bearer '+account.mcToken});
  if(r.status!==200)throw Error('Certificat Minecraft indisponible (HTTP '+r.status+').');
  const cert=r.json,identity=await http.getJSON('https://sessionserver.mojang.com/session/minecraft/profile/'+uuid+'?unsigned=false');
  const property=(identity.properties||[]).find(p=>p.name==='textures'&&p.signature);
  if(identity.id?.toLowerCase()!==uuid||!property)throw Error('Profil Minecraft signé indisponible.');
  const expires=Date.parse(cert.expiresAt);if(!Number.isFinite(expires)||expires<=Date.now())throw Error('Certificat Minecraft expiré.');
  const privateKey=crypto.createPrivateKey({key:der(cert.keyPair.privateKey),format:'der',type:'pkcs8'});
  cached={uuid,until:Math.min(expires,Date.parse(cert.refreshedAfter)||expires),privateKey,certificate:{publicKey:der(cert.keyPair.publicKey).toString('base64'),expiresAt:cert.expiresAt,signature:cert.publicKeySignatureV2},identity:{value:property.value,signature:property.signature}};
 }
 const payload=Buffer.from(`xrn-presence-v2\n${audience}\n${challenge.id}\n${uuid}`);
 return {uuid,challenge:challenge.id,certificate:cached.certificate,identity:cached.identity,proof:crypto.sign('RSA-SHA256',payload,cached.privateKey).toString('base64')};
}
// Certificates' private signing keys live only in this process. Never log,
// persist or send them to the relay. Only a challenge signature is sent.
module.exports={make,clear(){cached=null;}};
