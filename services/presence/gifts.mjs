// One code is a server-side choice of ONE premium cape, never a client-side price discount.
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const encoder=new TextEncoder(),hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
export function normalizeCode(value){return typeof value==='string'?value.trim().toUpperCase().replace(/[\s-]/g,''):'';}
async function digest(code,env){
 // Server-only pepper prevents offline guessing even if code digests are copied.
 const pepper=env.XRN_GIFT_PEPPER;if(!pepper||pepper.length<32)throw Error('gifts_unconfigured');
 const key=await crypto.subtle.importKey('raw',encoder.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(normalizeCode(code)))));
}
async function body(request){
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_body');let text='',size=0;const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw Error('invalid_body');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
 const b=JSON.parse(text);if(!b||typeof b!=='object'||Array.isArray(b))throw Error('invalid_body');return b;
}
function isAdmin(uuid,env){return /^[a-f0-9]{32}$/.test(env.XRN_GIFT_ADMIN_UUID||'')&&uuid===env.XRN_GIFT_ADMIN_UUID;}
function configured(env){return typeof env.XRN_GIFT_PEPPER==='string'&&env.XRN_GIFT_PEPPER.length>=32;}
export async function giftRights(store,mode,uuid){return await store.get('gift:ent:'+mode+':'+uuid)||[];}
async function hourlyLimit(directory,uuid){
 const now=Date.now(),key='r:gift-hour:'+uuid+':'+Math.floor(now/3600000);
 return directory.store.transaction(async tx=>{const r=await tx.get(key)||{n:0,until:now+3600000};if(r.n>=12)return false;r.n++;await tx.put(key,r);return true;});
}
export async function handleGifts(request,directory,{uuid,mode,products}){
 const {store,env}=directory,path=new URL(request.url).pathname,admin=isAdmin(uuid,env);
 if(path==='/v2/shop/gifts/status')return json({canGenerate:admin&&configured(env),available:configured(env)});
 if(!configured(env))return json({error:'gifts_unavailable'},503);
 try{
  if(path==='/v2/shop/gifts/redeem'){
   const ip=request.headers.get('CF-Connecting-IP')||'unknown';
   if(!await directory.rate(uuid,'gift-account',3)||!await directory.rate(ip,'gift-ip',10)||!await hourlyLimit(directory,uuid))return json({error:'gift_rate_limit'},429);
   const b=await body(request),code=normalizeCode(b.code);
   if(Object.keys(b).some(k=>!['code','product'].includes(k))||!/^[A-Z0-9]{4,64}$/.test(code)||!products.some(p=>p.id===b.product&&p.amount>0))return json({error:'invalid_gift_request'},400);
   const hash=await digest(code,env),key='gift:code:'+mode+':'+hash,now=Date.now();
   const result=await store.transaction(async tx=>{
    const gift=await tx.get(key);
    if(!gift||gift.state!=='ready'||gift.expiresAt<=now||(gift.recipient&&gift.recipient!==uuid)||!gift.products.includes(b.product))return {error:'invalid_or_used_code'};
    const rights=[...(await tx.get('shop:ent:'+mode+':'+uuid)||[]),...(await giftRights(tx,mode,uuid)),...(await tx.get('e:'+uuid)||[])];
    if(rights.includes(b.product))return {error:'already_owned'};
    gift.state='used';gift.usedBy=uuid;gift.usedAt=now;gift.product=b.product;
    await tx.put(key,gift);await tx.put('gift:ent:'+mode+':'+uuid,[...new Set([...(await giftRights(tx,mode,uuid)),b.product])]);
    await tx.put('gift:claim:'+mode+':'+gift.id,{gift:gift.id,uuid,product:b.product,usedAt:now});
    return {ok:true,product:b.product};
   });
   return result.error?json(result,result.error==='already_owned'?409:400):json(result);
  }
  if(!admin)return json({error:'admin_required'},403);
  if(path==='/v2/shop/gifts/create'){
   const b=await body(request);if(Object.keys(b).some(k=>!['prefix','code','recipient','days'].includes(k)))return json({error:'invalid_gift_request'},400);
   const recipient=b.recipient||'';if(recipient&&!/^[a-f0-9]{32}$/.test(recipient))return json({error:'invalid_recipient'},400);
   const days=b.days??30;if(!Number.isInteger(days)||days<1||days>366)return json({error:'invalid_expiry'},400);
   let code;
   if(b.code){code=normalizeCode(b.code);if(!/^[A-Z0-9]{4,64}$/.test(code))return json({error:'invalid_code'},400);if(code.length<12&&!recipient)return json({error:'short_code_requires_recipient'},400);}
   else{const prefix=normalizeCode(b.prefix||'XRN');if(!/^[A-Z0-9]{1,16}$/.test(prefix))return json({error:'invalid_prefix'},400);code=prefix+'-'+random().match(/.{4}/g).join('-');}
   const key='gift:code:'+mode+':'+await digest(code,env),now=Date.now(),id=random();
   const gift={id,products:products.filter(p=>p.amount>0).map(p=>p.id),state:'ready',createdAt:now,expiresAt:now+days*86400000,recipient,createdBy:uuid};
   const saved=await store.transaction(async tx=>{if(await tx.get(key))return false;await tx.put(key,gift);await tx.put('gift:id:'+mode+':'+id,key);await tx.put('gift:list:'+mode+':'+now+':'+id,key);return true;});
   if(!saved)return json({error:'code_exists'},409);
   return json({id,code,expiresAt:gift.expiresAt,recipient,choice:'one_premium_cape'});
  }
  if(path==='/v2/shop/gifts/list'){
   await body(request);const index=await store.list({prefix:'gift:list:'+mode+':',reverse:true,limit:51}),keys=[...index.values()],hasMore=keys.length>50;
   const gifts=await Promise.all(keys.slice(0,50).map(async key=>{const g=await store.get(key);return {id:g.id,state:g.state==='ready'&&g.expiresAt<=Date.now()?'expired':g.state,expiresAt:g.expiresAt,createdAt:g.createdAt,recipient:g.recipient||'',usedBy:g.usedBy||'',product:g.product||''};}));return json({gifts,hasMore});
  }
  if(path==='/v2/shop/gifts/revoke'){
   const b=await body(request);if(Object.keys(b).some(k=>k!=='id')||!/^[a-f0-9]{32}$/.test(b.id||''))return json({error:'invalid_gift_request'},400);
   const result=await store.transaction(async tx=>{const key=await tx.get('gift:id:'+mode+':'+b.id),g=key&&await tx.get(key);if(!g)return 'not_found';if(g.state==='used')return 'already_used';g.state='revoked';await tx.put(key,g);return 'ok';});return json({ok:result==='ok',...(result==='ok'?{}:{error:result})},result==='ok'?200:409);
  }
  return json({error:'not_found'},404);
 }catch{return json({error:'invalid_gift_request'},400);}
}
