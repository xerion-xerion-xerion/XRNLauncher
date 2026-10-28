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
 const data=await http.getJSON(root+'/v2/players');
 const players=(data.pseudos||[]).filter(p=>p.verified===true&&/^[a-f0-9]{32}$/i.test(p.uuid)&&p.expiresAt>Date.now());
 const file=path.join(util.appRoot(),'communaute.json');util.ensureDir(path.dirname(file));
 const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify({version:2,pseudos:players,misAJour:new Date().toISOString()}));fs.renameSync(temp,file);
 return {configured:true,total:players.length};
}
let session='',sessionUntil=0,certificateUntil=0,sessionUuid='',lastStyle='',lastRefresh=0,lastHeartbeat=0,lastError='';
let rights=['cape_xrn'];
function selectedCosmetic(){try{const file=path.join(util.appRoot(),'cosmetique.json');if(fs.existsSync(file)){const r=JSON.parse(fs.readFileSync(file,'utf8'));return ['cape_xrn','cape_orbite','cape_nova'].includes(r.equipe)?r.equipe:'';}const r=JSON.parse(fs.readFileSync(path.join(cfg.load().gameDir,'config','xrnhud.json'),'utf8')).reglages||{};return ['cape_xrn','cape_orbite','cape_nova'].includes(r.equipe)?r.equipe:'';}catch{return '';}}
function saveRights(list){
 rights=['cape_xrn',...['cape_orbite','cape_nova'].filter(id=>Array.isArray(list)&&list.includes(id))];
 const file=path.join(util.appRoot(),'droits.json');util.ensureDir(path.dirname(file));
 fs.writeFileSync(file+'.tmp',JSON.stringify({droits:rights,misAJour:new Date().toISOString()}));fs.renameSync(file+'.tmp',file);
}
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
 const challenge=await http.getJSON(root+'/v2/challenge');
 const proof=await require('./presence-proof').make(account,challenge,root);
 const style=selectedStyle();
 const cosmetic=selectedCosmetic();
 const result=await http.postJSON(root+'/v2/register',{...proof,style,cosmetic});
 if(result.status!==200||result.json?.player?.uuid!==account.id.toLowerCase())throw Error('Inscription de présence refusée.');
 session=/^[a-f0-9]{64}$/.test(result.json.session||'')?result.json.session:'';
 if(!session)throw Error('Session du relais invalide.');
 certificateUntil=Date.parse(proof.certificate.expiresAt);sessionUntil=Math.min(Date.now()+3500000,certificateUntil);sessionUuid=account.id;lastStyle=JSON.stringify({style,cosmetic});lastHeartbeat=Date.now();lastError='';saveRights(result.json.rights);
 await refresh();lastRefresh=Date.now();return {registered:true};
}
let busy=false,retryAfter=0,inFlight=null,gameRunning=false;
async function syncNow(account,preLaunch=false){
 if(busy||(!preLaunch&&Date.now()<retryAfter)||!base())return;
 busy=true;
 try{
  if(configuredSharing()&&account?.minecraftVerified&&account.mcToken){
   if(!session||sessionUntil<Date.now()||sessionUuid!==account.id){
    // Certificate signatures never modify Minecraft's multiplayer join proof.
    await register(account);
   }
   const style=selectedStyle(),cosmetic=selectedCosmetic(),fingerprint=JSON.stringify({style,cosmetic});
   if(fingerprint!==lastStyle||Date.now()-lastHeartbeat>25000){
    const result=await http.postJSON(base()+'/v2/style',{style,cosmetic},{Authorization:'Bearer '+session});
    if(result.status!==200){if(result.status===401)session='';throw Error('Mise à jour du style refusée');}
    lastStyle=fingerprint;lastHeartbeat=Date.now();sessionUntil=Math.min(Date.now()+3500000,certificateUntil);lastError='';
   }
  }else{session='';sessionUuid='';}
  if(Date.now()-lastRefresh>15000){await refresh();lastRefresh=Date.now();}
 }catch(error){lastError=error.message;retryAfter=Date.now()+60000;throw error;}finally{busy=false;}
}
function sync(account){
 if(inFlight)return inFlight;
 inFlight=syncNow(account).finally(()=>{inFlight=null;});return inFlight;
}
async function beforeGameStart(account){
 gameRunning=true;
 if(inFlight)await inFlight.catch(()=>{});
 inFlight=syncNow(account,true).finally(()=>{inFlight=null;});return inFlight;
}
function afterGameExit(){gameRunning=false;}
async function refreshRights(){if(!session)return rights;const r=await http.getJSON(base()+'/v2/me',{headers:{Authorization:'Bearer '+session}});saveRights(r.rights);return rights;}
module.exports={base,refresh,register,sync,selectedStyle,selectedCosmetic,beforeGameStart,afterGameExit,refreshRights,status(){return {configured:!!base(),private:!!cfg.load().developerMode&&base()==='http://127.0.0.1:8789',sharing:configuredSharing(),registered:!!session&&sessionUntil>Date.now(),uuid:sessionUuid,lastRefresh,lastHeartbeat,error:lastError,rights:[...rights]};}};
function configuredSharing(){return cfg.load().shareAppearance!==false;}
