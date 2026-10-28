'use strict';
const fs=require('fs'),path=require('path'),util=require('./util'),cfg=require('./config'),presence=require('./presence');
const collection=require('../cosmetics.json').products;
const skinCache=new Map();
async function skin(account){
 if(!account)return {name:'',dataUrl:''};
 let url=account.skinUrl||'';if(!url&&account.name)url=await require('./skins').parNom(account.name);
 try{
  const u=new URL(url);if(u.hostname==='textures.minecraft.net'&&u.protocol==='http:')u.protocol='https:';
  if(u.protocol!=='https:'||u.hostname!=='textures.minecraft.net'||!/^\/texture\/[a-f0-9]+$/i.test(u.pathname))return {name:account.name,dataUrl:''};
  if(skinCache.has(u.href))return {name:account.name,dataUrl:skinCache.get(u.href)};
  const {res}=await require('./http').request(u.href);if(res.statusCode!==200){res.resume();return {name:account.name,dataUrl:''};}
  let size=0,chunks=[];for await(const c of res){size+=c.length;if(size>512*1024){res.destroy();throw Error('Skin trop volumineux.');}chunks.push(c);}
  const png=Buffer.concat(chunks);if(png.length<24||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return {name:account.name,dataUrl:''};
  const w=png.readUInt32BE(16),h=png.readUInt32BE(20);if(w>1024||h>1024||w<64||!(w===h||w===2*h))return {name:account.name,dataUrl:''};
  const dataUrl='data:image/png;base64,'+png.toString('base64');if(skinCache.size>=8)skinCache.clear();skinCache.set(u.href,dataUrl);return {name:account.name,dataUrl};
 }catch{return {name:account.name,dataUrl:''};}
}
function wardrobeFile(){return path.join(util.appRoot(),'cosmetique.json');}
function selection(){try{const f=wardrobeFile();if(fs.statSync(f).size>4096)return '';const id=JSON.parse(fs.readFileSync(f,'utf8')).equipe;return collection.some(p=>p.id===id)?id:'';}catch{return '';}}
async function catalogue(account){
 const state=presence.status();
 const own=state.registered&&state.uuid===account?.id;
 if(own)await presence.refreshRights().catch(()=>{});
 let shop={mode:'unavailable',products:[]};try{shop=await require('./http').getJSON(presence.base()+'/v2/shop/catalogue');}catch{}
 let gifts={available:false,canGenerate:false};if(own)try{gifts=await presence.shop('gifts/status',{});}catch{}
 return {gifts,products:collection.map(p=>({...p,paymentUrl:'',purchasable:shop.products?.find(s=>s.id===p.id)?.purchasable===true,amount:shop.products?.find(s=>s.id===p.id)?.amount??p.amount})),equipped:selection(),rights:own?presence.status().rights:['cape_job'],presence:{...presence.status(),registered:own},connected:account?.minecraftVerified===true,paymentAvailable:['test','live'].includes(shop.mode),paymentMode:shop.mode};
}
function requireSession(account){if(!account?.minecraftVerified||!presence.status().registered||presence.status().uuid!==account.id)throw Error('Connectez votre compte Minecraft au relais avant de tester un achat.');}
async function checkout(account,id){
 requireSession(account);if(!collection.some(p=>p.id===id&&!p.free))throw Error('Cape inconnue.');
 const result=await presence.shop('checkout',{product:id}),url=new URL(result.url);
 if(!['test','live'].includes(result.mode)||result.test!==(result.mode==='test')||!/^[a-f0-9]{40}$/.test(result.order||'')||url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password)throw Error('Lien de paiement refusé.');
 return {order:result.order,url:url.href,test:result.test,mode:result.mode};
}
async function paymentStatus(account,order){
 requireSession(account);if(!/^[a-f0-9]{40}$/.test(order||''))throw Error('Commande invalide.');
 const result=await presence.shop('status',{order});await presence.refreshRights();return result;
}
async function orders(account){requireSession(account);return presence.shop('orders',{});}
async function equip(account,id){
 const product=collection.find(p=>p.id===id);if(id&&!product)throw Error('Cape inconnue.');
 if(id&&!product.free){
  if(!account?.minecraftVerified||!presence.status().registered||presence.status().uuid!==account.id)throw Error('Connectez votre compte Minecraft pour vérifier cette cape.');
  if(!(await presence.refreshRights()).includes(id))throw Error('Cette cape ne fait pas partie de votre collection.');
 }
 const file=wardrobeFile();util.ensureDir(path.dirname(file));
 fs.writeFileSync(file+'.tmp',JSON.stringify({schema:1,accountId:account?.id||'',equipe:id,updatedAt:new Date().toISOString()}));fs.renameSync(file+'.tmp',file);
 await presence.sync(account).catch(()=>{});
 return {equipped:id,presence:presence.status()};
}
async function gift(account,action,body){requireSession(account);const r=await presence.shop('gifts/'+action,body);if(action==='redeem'){await presence.refreshRights();await presence.sync(account);}return r;}
module.exports={gift,catalogue,equip,selection,wardrobeFile,skin,checkout,paymentStatus,orders};
