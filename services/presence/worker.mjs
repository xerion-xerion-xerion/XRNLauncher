const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const random=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const hash=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));
export function style(s={}) {
 const rgb=(n,f)=>Number.isInteger(n)&&n>=0&&n<=0xFFFFFF?n:f;
 return {enabled:s.enabled===true,badge:s.badge!==false,gradient:s.gradient!==false,start:rgb(s.start,0xA78BFA),end:rgb(s.end,0xF4EEFF)};
}
async function body(request) {
 if(Number(request.headers.get('Content-Length'))>4096)throw Error('body');
 const reader=request.body?.getReader();if(!reader)throw Error('body');let text='',size=0;const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error('body');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
 const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('body');return value;
}
// One strongly consistent directory: consuming a nonce and publishing a style
// cannot race against another registration. Minecraft tokens never reach it.
export class Directory {
 constructor(ctx,env){this.ctx=ctx;this.store=ctx.storage;this.env=env;}
 async rate(ip,kind,max){
  const key='r:'+await hash(ip+':'+kind+':'+Math.floor(Date.now()/60000));
  if(!await this.store.getAlarm())await this.store.setAlarm(Date.now()+180000);
  return this.store.transaction(async tx=>{const r=await tx.get(key)||{n:0,until:Date.now()+120000};if(r.n>=max)return false;r.n++;await tx.put(key,r);return true;});
 }
 async fetch(request){
  const u=new URL(request.url),now=Date.now(),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  let stage='request';try {
   if(u.pathname==='/v1/players'&&request.method==='GET'){
    const all=await this.store.list({prefix:'p:',limit:2000});
    return json({pseudos:[...all.values()].filter(p=>p.expiresAt>now).map(({uuid,pseudo,style,expiresAt})=>({uuid,pseudo,style,expiresAt,verified:true}))});
   }
   if(u.pathname==='/v1/challenge'&&request.method==='GET'){
    if(!await this.rate(ip,'challenge',12))return json({error:'rate_limit'},429);
    const id=random(20);await this.store.put('c:'+id,{until:now+120000});
    return json({id,expiresAt:now+120000});
   }
   if(u.pathname==='/v1/register'&&request.method==='POST'){
    if(!await this.rate(ip,'register',12))return json({error:'rate_limit'},429);
    const b=await body(request);
    if(!/^[a-f0-9]{40}$/.test(b.challenge)||!/^\w{1,16}$/.test(b.username))return json({error:'invalid_registration'},400);
    const nonce=await this.store.transaction(async tx=>{const c=await tx.get('c:'+b.challenge);await tx.delete('c:'+b.challenge);return c;});
    if(!nonce||nonce.until<now)return json({error:'expired_challenge'},401);
    const proofUrl=new URL('https://sessionserver.mojang.com/session/minecraft/hasJoined');proofUrl.searchParams.set('username',b.username);proofUrl.searchParams.set('serverId',b.challenge);
    stage='minecraft';
    const response=await fetch(proofUrl,{redirect:'manual',signal:AbortSignal.timeout(10000)});
    if(response.status!==200)return json({error:'minecraft_proof_required'},401);
    const proof=await response.json();
    if(!/^[a-f0-9]{32}$/i.test(proof.id)||String(proof.name).toLowerCase()!==b.username.toLowerCase())return json({error:'invalid_proof'},401);
    stage='publish';const uuid=proof.id.toLowerCase(),session=random(32),sessionHash=await hash(session),player={uuid,pseudo:proof.name,style:style(b.style),expiresAt:now+90000,sessionHash};
    await this.store.transaction(async tx=>{const old=await tx.get('p:'+uuid);if(old?.sessionHash)await tx.delete('s:'+old.sessionHash);await tx.put('s:'+sessionHash,{uuid,until:now+3600000});await tx.put('p:'+uuid,player);});
    return json({player:{uuid},session});
   }
   if(u.pathname==='/v1/style'&&request.method==='POST'){
    if(!await this.rate(ip,'style',120))return json({error:'rate_limit'},429);
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
    if(!/^[a-f0-9]{64}$/.test(token))return json({error:'session_required'},401);
    const b=await body(request),key=await hash(token);
    const ok=await this.store.transaction(async tx=>{const session=await tx.get('s:'+key);if(!session||session.until<=now)return false;const p=await tx.get('p:'+session.uuid);if(!p||p.sessionHash!==key)return false;p.style=style(b.style);p.expiresAt=now+90000;session.until=now+3600000;await tx.put('s:'+key,session);await tx.put('p:'+p.uuid,p);return true;});
    return ok?json({ok:true}):json({error:'session_expired'},401);
   }
   return json({error:'not_found'},404);
  }catch(error){console.warn('presence_request_failed',stage,error.name);return json({error:stage==='minecraft'?'minecraft_unavailable':'invalid_request'},stage==='minecraft'?503:400);}
 }
 async alarm(){
  const now=Date.now();const all=await this.store.list({limit:10000});
  const dead=[...all].filter(([k,v])=>k.startsWith('p:')?v.expiresAt<now:(v.until||0)<now).map(([k])=>k);
  if(dead.length)await this.store.delete(dead);
  if(all.size>dead.length)await this.store.setAlarm(now+180000);
 }
}
export default {async fetch(request,env){
 const u=new URL(request.url);
 if(u.pathname==='/health')return json({service:'xrn-presence',version:1});
 if(!u.pathname.startsWith('/v1/'))return json({error:'not_found'},404);
 if(request.method!=='GET'&&request.method!=='POST')return json({error:'method'},405);
 return env.DIRECTORY.get(env.DIRECTORY.idFromName('players-v1')).fetch(request);
}};
