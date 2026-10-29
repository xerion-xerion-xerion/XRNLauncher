'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),util=require('./util'),presence=require('./presence'),http=require('./http'),config=require('./config');
const valid=id=>typeof id==='string'&&/^prime_[a-f0-9]{32}$/.test(id),dir=()=>path.join(util.appRoot(),'prime-capes'),stateFile=()=>path.join(util.appRoot(),'prime.json');
let last=0,inFlight=null,current=null,pendingOutfit=null;
function accountCheck(account){if(!account?.minecraftVerified||!presence.status().registered||presence.status().uuid!==account.id)throw Error('Connectez votre compte Microsoft dans XRN pour utiliser Prime.');}
async function call(account,action,body={}){accountCheck(account);return presence.shop('prime/'+action,body);}
function writeState(account,state,capes){const file=stateFile();util.ensureDir(path.dirname(file));fs.writeFileSync(file+'.tmp',JSON.stringify({schema:1,uuid:account.id,launched:true,active:state.active===true,until:state.until,verifiedUntil:Math.min(state.until||0,Date.now()+240000),capes:capes.map(c=>({id:c.id,name:c.name,sha256:c.sha256})),outfit:pendingOutfit?.uuid===account.id?pendingOutfit:undefined,updatedAt:Date.now()}));fs.renameSync(file+'.tmp',file);}
async function cacheCape(c){
 if(!valid(c.id)||!/^[a-f0-9]{64}$/.test(c.sha256||''))return '';
 util.ensureDir(dir());const file=path.join(dir(),c.id+'.png');
 if(fs.existsSync(file)&&fs.statSync(file).size<=524288&&crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===c.sha256)return file;
 const png=await presence.capeBytes(c.id);if(png.length>524288||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||crypto.createHash('sha256').update(png).digest('hex')!==c.sha256)throw Error('La texture de cape reçue est invalide.');
 fs.writeFileSync(file+'.tmp',png);fs.renameSync(file+'.tmp',file);return file;
}
async function cachePublic(players){
 let visible=new Set();try{const f=path.join(util.appRoot(),'visible-players.json');if(fs.statSync(f).size<16384){const v=JSON.parse(fs.readFileSync(f,'utf8'));if(v.updatedAt>Date.now()-30000&&Array.isArray(v.uuids))visible=new Set(v.uuids.filter(id=>/^[a-f0-9]{32}$/.test(id)));}}catch{}
 const capes=[...new Map(players.filter(p=>visible.has(p.uuid)&&p.prime?.active&&p.customCape&&valid(p.customCape.id)).map(p=>[p.customCape.id,p.customCape])).values()].slice(0,128);
 for(let i=0;i<capes.length;i+=3)await Promise.allSettled(capes.slice(i,i+3).map(cacheCape));
}
async function refreshState(account,force=false){
 accountCheck(account);if(inFlight)return inFlight;if(!force&&current?.uuid===account.id&&Date.now()-last<45000)return current;
 inFlight=(async()=>{const status=await call(account,'status'),library=await call(account,'capes/list');await presence.refreshRights();const capes=library.capes.filter(c=>valid(c.id)&&/^[a-f0-9]{64}$/.test(c.sha256||''));
 for(let i=0;i<capes.length;i+=3)await Promise.allSettled(capes.slice(i,i+3).map(cacheCape));writeState(account,status,capes);last=Date.now();current={...status,...library,uuid:account.id};return current;})();
 try{return await inFlight;}finally{inFlight=null;}
}
async function load(account){await presence.sync(account);const state=await refreshState(account,true),outfits=await call(account,'outfits/list');return {...state,...outfits,style:presence.selectedStyle(),equipped:presence.selectedCosmetic(),capes:state.capes};}
async function action(account,verb,body={}){
 const allowed=['checkout','cancel','gifts/create','gifts/list','gifts/redeem','gifts/revoke','capes/upload','capes/delete','capes/rename','outfits/save','outfits/delete','outfits/equip'];if(!allowed.includes(verb))throw Error('Action Prime inconnue.');accountCheck(account);
 const r=await call(account,verb,body);
 if(verb==='checkout'){const u=new URL(r.url);if(u.protocol!=='https:'||u.hostname!=='checkout.stripe.com'||u.username||u.password)throw Error('Lien Stripe refusé.');return {...r,url:u.href};}
 if(verb==='outfits/equip'){
  const o=r.outfit;await require('./cosmetics').equip(account,o.cosmetic);const file=path.join(config.load().gameDir,'config','xrnhud.json');let data={};try{if(fs.statSync(file).size>262144)throw Error('Fichier de réglages trop volumineux.');data=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  data.reglages={...data.reglages,nameStyle:o.style.enabled,ownBadge:o.style.badge,nameGradient:o.style.gradient,nameAnimate:o.style.animate,nameRainbow:o.style.rainbow,nameStart:o.style.start|0xff000000,nameEnd:o.style.end|0xff000000};util.ensureDir(path.dirname(file));fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file);pendingOutfit={uuid:account.id,revision:Date.now(),style:o.style};await refreshState(account,true);await presence.sync(account);
 }
 if(verb.startsWith('capes/')||verb==='gifts/redeem'||verb==='cancel')await refreshState(account,true);return r;
}
async function preview(account,id){accountCheck(account);const c=current?.uuid===account.id&&current.capes.find(c=>c.id===id);if(!c)throw Error('Cape inconnue.');const file=await cacheCape(c);return 'data:image/png;base64,'+fs.readFileSync(file).toString('base64');}
module.exports={preview,load,action,refreshState,cachePublic,stateFile,dir,cacheCape};
