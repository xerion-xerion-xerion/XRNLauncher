'use strict';
const fs=require('fs'),path=require('path');
const http=require('./http'),cfg=require('./config'),util=require('./util');
function base(){
 const raw=String(cfg.load().presenceUrl||cfg.shipped().presenceUrl||'').replace(/\/+$/,'');if(!raw)return '';
 const url=new URL(raw);
 if(url.protocol!=='https:'&&!(cfg.load().developerMode&&['127.0.0.1','localhost'].includes(url.hostname)))throw Error('Le service de présence doit utiliser HTTPS.');
 return raw;
}
async function refresh(){
 const root=base();if(!root)return {configured:false};
 const data=await http.getJSON(root+'/v1/players');
 const players=(data.pseudos||[]).filter(p=>p.verified===true&&/^[a-f0-9]{32}$/i.test(p.uuid)&&p.expiresAt>Date.now());
 const file=path.join(util.appRoot(),'communaute.json');util.ensureDir(path.dirname(file));
 const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify({version:2,pseudos:players,misAJour:new Date().toISOString()}));fs.renameSync(temp,file);
 return {configured:true,total:players.length};
}
let session='',sessionUntil=0,sessionUuid='',lastStyle='',lastRefresh=0,lastHeartbeat=0;
function selectedStyle(){
 try{
  const file=path.join(cfg.load().gameDir,'config','xrnhud.json');
  if(fs.statSync(file).size>256*1024)return {};
  const r=JSON.parse(fs.readFileSync(file,'utf8')).reglages||{};
  const rgb=(v,f)=>Number.isInteger(v)?(v&0xFFFFFF):f;
  return {enabled:r.nameStyle===true,badge:r.ownBadge!==false,gradient:r.nameGradient!==false,start:rgb(r.nameStart,0xA78BFA),end:rgb(r.nameEnd,0xF4EEFF)};
 }catch{return {enabled:false,badge:true,gradient:true,start:0xA78BFA,end:0xF4EEFF};}
}
async function register(account){
 const root=base();if(!root||!account?.minecraftVerified||!account.mcToken)return {registered:false};
 const challenge=await http.getJSON(root+'/v1/challenge');
 if(!/^[a-f0-9]{40}$/.test(challenge.id||''))throw Error('Challenge de présence invalide.');
 const proof=await http.postJSON('https://sessionserver.mojang.com/session/minecraft/join',{
  accessToken:account.mcToken,selectedProfile:account.id,serverId:challenge.id
 });
 if(proof.status!==204)throw Error('Minecraft n’a pas confirmé la présence.');
 const style=selectedStyle();
 const result=await http.postJSON(root+'/v1/register',{challenge:challenge.id,username:account.name,style});
 if(result.status!==200||result.json?.player?.uuid!==account.id.toLowerCase())throw Error('Inscription de présence refusée.');
 session=/^[a-f0-9]{64}$/.test(result.json.session||'')?result.json.session:'';sessionUntil=Date.now()+3500000;sessionUuid=account.id;lastStyle=JSON.stringify(style);lastHeartbeat=Date.now();
 await refresh();lastRefresh=Date.now();return {registered:true};
}
let busy=false,retryAfter=0;
async function sync(account){
 if(busy||Date.now()<retryAfter||!base())return;
 busy=true;
 try{
  if(configuredSharing()&&account?.minecraftVerified&&account.mcToken){
   if(!session||sessionUntil<Date.now()||sessionUuid!==account.id)await register(account);
   const style=selectedStyle(),fingerprint=JSON.stringify(style);
   if(fingerprint!==lastStyle||Date.now()-lastHeartbeat>25000){
    const result=await http.postJSON(base()+'/v1/style',{style},{Authorization:'Bearer '+session});
    if(result.status!==200){if(result.status===401)session='';throw Error('Mise à jour du style refusée');}
    lastStyle=fingerprint;lastHeartbeat=Date.now();
   }
  }else{session='';sessionUuid='';}
  if(Date.now()-lastRefresh>15000){await refresh();lastRefresh=Date.now();}
 }catch(error){retryAfter=Date.now()+60000;throw error;}finally{busy=false;}
}
module.exports={base,refresh,register,sync,selectedStyle};
function configuredSharing(){return cfg.load().shareAppearance!==false;}
