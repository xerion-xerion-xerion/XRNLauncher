#!/usr/bin/env node
'use strict';
// Admin-only CLI. These credentials never belong in the distributed launcher.
const fs=require('fs'),crypto=require('crypto');
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const installations=process.env.XRN_INSTALLATIONS_NAMESPACE_ID,messages=process.env.XRN_MESSAGES_NAMESPACE_ID;
if(!account||!token){console.error('CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_API_TOKEN sont requis.');process.exit(1);}
async function api(ns,route,method='GET',value){
 if(!/^[a-f0-9]{32}$/.test(ns||''))throw Error('Namespace requis');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/storage/kv/namespaces/'+ns+route,{method,headers:{Authorization:'Bearer '+token,...(value?{'Content-Type':'application/json'}:{})},...(value?{body:JSON.stringify(value)}:{})});
 if(!r.ok)throw Error('Cloudflare HTTP '+r.status);return r.json();
}
(async()=>{
 const command=process.argv[2];
 if(command==='list'){
  let cursor;const output=[];
  do{const page=await api(installations,'/keys?prefix=install%3A&limit=1000'+(cursor?'&cursor='+encodeURIComponent(cursor):''));for(const k of page.result||[]){const id=k.name.slice(8);if(!/^[a-f0-9]{32}$/.test(id))continue;const v=await api(installations,'/values/'+encodeURIComponent(k.name));output.push({id,version:v.version,lastSeen:v.quand});}cursor=page.result_info?.cursor;}while(cursor);
  console.log(JSON.stringify(output,null,2));return;
 }
 if(command==='send'){
  if(!process.argv[3])throw Error('Fichier JSON du message requis');
  const value=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
  if(!value.id)value.id=crypto.randomUUID();
  if(!Array.isArray(value.cible)||!value.cible.length||value.cible.some(id=>!/^[a-f0-9]{32}$/.test(id)))throw Error('Une liste cible d’identifiants est obligatoire.');
  if(JSON.stringify(value).length>8192)throw Error('Message trop long');
  await api(messages,'/values/message','PUT',value);console.log('Notification ciblée enregistrée : '+value.id);return;
 }
 throw Error('Usage : node scripts/admin-notifications.cjs list | send message.json');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
