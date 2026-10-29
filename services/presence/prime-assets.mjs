import {capeBucket} from './prime-storage.mjs';
import {primeStatus,PRIME} from './prime.mjs';
const json=(b,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''),random=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
const assetKey=(mode,id)=>'prime:asset:'+mode+':'+id,listKey=(mode,uuid)=>'prime:capes:'+mode+':'+uuid,quotaKey=(mode,uuid)=>'prime:imports:'+mode+':'+uuid;
const validId=id=>typeof id==='string'&&/^prime_[a-f0-9]{32}$/.test(id);
const fields=(b,allowed)=>b&&typeof b==='object'&&!Array.isArray(b)&&!Object.keys(b).some(k=>!allowed.includes(k));
const safeName=value=>typeof value==='string'&&value.trim().length>=1&&value.trim().length<=40&&!/[\x00-\x1f\x7f]/.test(value)?value.trim():'';
function crc(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
export async function validateCapePNG(png){
 if(!(png instanceof Uint8Array)||png.byteLength<45||png.byteLength>524288||hex(png.subarray(0,8))!=='89504e470d0a1a0a')throw Error('invalid_png');
 const view=new DataView(png.buffer,png.byteOffset,png.byteLength);let pos=8,ihdr=false,end=false,idat=false,idatEnded=false,count=0,compressed=[];
 while(pos<png.length){if(pos+12>png.length||++count>128)throw Error('invalid_png');const len=view.getUint32(pos),type=String.fromCharCode(...png.subarray(pos+4,pos+8));if(len>524288||pos+12+len>png.length||crc(png.subarray(pos+4,pos+8+len))!==view.getUint32(pos+8+len))throw Error('invalid_png');
  if(!ihdr&&type!=='IHDR')throw Error('invalid_png');
  if(type==='IHDR'){if(ihdr||len!==13||view.getUint32(pos+8)!==1024||view.getUint32(pos+12)!==512||png[pos+16]!==8||png[pos+17]!==6||png[pos+18]!==0||png[pos+19]!==0||png[pos+20]!==0)throw Error('invalid_dimensions');ihdr=true;}
  else if(type==='IDAT'){if(idatEnded)throw Error('invalid_png');idat=true;compressed.push(png.slice(pos+8,pos+8+len));}
  else if(type==='IEND'){if(len!==0||!idat||pos+12!==png.length)throw Error('invalid_png');end=true;}
  else if(!['sRGB','gAMA'].includes(type)||idat)throw Error('unsupported_png');
  if(idat&&type!=='IDAT')idatEnded=true;pos+=len+12;
 }
 if(!end)throw Error('invalid_png');const expected=512*(1024*4+1),reader=new Blob(compressed).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let read=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;const before=read;read+=value.length;if(read>expected)throw Error('png_too_large');for(let at=Math.ceil(before/4097)*4097;at<read;at+=4097)if(value[at-before]>4)throw Error('invalid_filter');}if(read!==expected)throw Error('invalid_png');}finally{await reader.cancel().catch(()=>{});}
 return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',png)));
}
export async function primeCapeRights(store,env,mode,uuid){if(!(await primeStatus(store,env,mode,uuid)).active)return [];const ids=await store.get(listKey(mode,uuid))||[],result=[];for(const id of ids){const a=await store.get(assetKey(mode,id));if(a?.owner===uuid&&a.state==='ready')result.push(id);}return result;}
export async function primeCapeInfo(store,env,mode,id,uuid){if(!validId(id)||!(await primeStatus(store,env,mode,uuid)).active)return null;const a=await store.get(assetKey(mode,id));return a?.owner===uuid&&a.state==='ready'?{id:a.id,sha256:a.sha256,name:a.name,width:1024,height:512}:null;}
export async function servePrimeCape(request,directory,mode,owner=''){
 const {store,env}=directory,id=new URL(request.url).pathname.split('/').at(-1);if(!validId(id))return json({error:'not_found'},404);
 const a=await store.get(assetKey(mode,id));if(!a||a.state!=='ready')return json({error:'not_found'},404);
 const self=owner===a.owner,p=await store.get('p:'+a.owner);
 if(!self&&(!(await primeStatus(store,env,mode,a.owner)).active||p?.cosmetic!==id||p.expiresAt<=Date.now()))return json({error:'not_found'},404);
 if(!await directory.rate(request.headers.get('CF-Connecting-IP')||'unknown','prime-textures',240))return json({error:'rate_limit'},429);
 const object=await capeBucket(directory).get(a.object);if(!object||object.customMetadata?.sha256!==a.sha256)return json({error:'not_found'},404);
 return new Response(object.body,{headers:{'Content-Type':'image/png','Content-Length':String(a.bytes),'X-Content-Type-Options':'nosniff','Cache-Control':self?'private, no-store':'public, max-age=30','Content-Security-Policy':"default-src 'none'",ETag:'"'+a.sha256+'"'}});
}
export async function handlePrimeCapes(request,directory,ctx,action){
 const {store,env}=directory,{uuid,mode,payload}=ctx;let b;try{b=JSON.parse(new TextDecoder().decode(await payload(request,action==='upload'?750000:4096)));}catch{return json({error:'invalid_upload'},400);}
 const current=await primeStatus(store,env,mode,uuid),now=Date.now();
 if(action==='list'){
  if(!fields(b,[]))return json({error:'invalid_request'},400);const ids=await store.get(listKey(mode,uuid))||[],capes=[];for(const id of ids){const a=await store.get(assetKey(mode,id));if(a?.owner===uuid&&a.state==='ready')capes.push({id:a.id,name:a.name,sha256:a.sha256,createdAt:a.createdAt,width:1024,height:512});}
  const used=(await store.get(quotaKey(mode,uuid))||[]).filter(r=>r.at>now-PRIME.windowMs&&(r.state==='ready'||r.until>now));return json({capes,remaining:Math.max(0,2-used.length),nextImportAt:used.length>=2?Math.min(...used.map(r=>r.at))+PRIME.windowMs:now,active:current.active});
 }
 if(!current.active)return json({error:'prime_required'},403);
 if(action==='upload'){
  if(!await directory.rate(uuid,'prime-upload',5))return json({error:'rate_limit'},429);
  const name=safeName(b.name);if(!fields(b,['name','png'])||!name||typeof b.png!=='string'||b.png.length>699052||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.png))return json({error:'invalid_upload'},400);
  let bytes,sha256;try{bytes=Uint8Array.from(atob(b.png),c=>c.charCodeAt(0));sha256=await validateCapePNG(bytes);}catch{return json({error:'invalid_png'},400);}
  const id='prime_'+random(),object='prime/'+mode+'/'+uuid+'/'+id+'.png',reserved=await store.transaction(async tx=>{if(!(await primeStatus(tx,env,mode,uuid)).active)return false;const quota=(await tx.get(quotaKey(mode,uuid))||[]).filter(r=>r.at>now-PRIME.windowMs&&(r.state==='ready'||r.until>now));if(quota.length>=2)return false;quota.push({id,at:now,state:'pending',until:now+300000});await tx.put(quotaKey(mode,uuid),quota);return true;});
  if(!reserved)return json({error:'weekly_limit'},429);
  try{
   await capeBucket(directory).put(object,bytes,{httpMetadata:{contentType:'image/png'},customMetadata:{sha256,owner:uuid}});
   await store.transaction(async tx=>{const quota=await tx.get(quotaKey(mode,uuid))||[],slot=quota.find(r=>r.id===id);if(!slot||slot.state!=='pending'||slot.until<Date.now()||!(await primeStatus(tx,env,mode,uuid)).active)throw Error('upload_expired');slot.state='ready';await tx.put(quotaKey(mode,uuid),quota);await tx.put(assetKey(mode,id),{id,owner:uuid,object,sha256,name,bytes:bytes.length,createdAt:now,state:'ready'});await tx.put(listKey(mode,uuid),[...(await tx.get(listKey(mode,uuid))||[]),id]);});
  }catch(e){await capeBucket(directory).delete(object).catch(()=>{});await store.transaction(async tx=>{const q=await tx.get(quotaKey(mode,uuid))||[];await tx.put(quotaKey(mode,uuid),q.filter(r=>r.id!==id||r.state==='ready'));});throw e;}
  return json({id,name,sha256,width:1024,height:512});
 }
 if(['rename','delete'].includes(action)){
  if(!fields(b,action==='rename'?['id','name']:['id'])||!validId(b.id)||(action==='rename'&&!safeName(b.name)))return json({error:'invalid_request'},400);
  const a=await store.get(assetKey(mode,b.id));if(a?.owner!==uuid||a.state!=='ready')return json({error:'not_found'},404);
  if(action==='rename'){a.name=safeName(b.name);await store.put(assetKey(mode,b.id),a);return json({ok:true});}
  await store.transaction(async tx=>{const asset=await tx.get(assetKey(mode,b.id));if(asset?.owner!==uuid||asset.state!=='ready')throw Error('asset_changed');asset.state='deleted';await tx.put(assetKey(mode,b.id),asset);await tx.put(listKey(mode,uuid),(await tx.get(listKey(mode,uuid))||[]).filter(id=>id!==b.id));const p=await tx.get('p:'+uuid);if(p?.cosmetic===b.id){p.cosmetic='';await tx.put('p:'+uuid,p);}});await capeBucket(directory).delete(a.object);return json({ok:true});
 }
 return json({error:'not_found'},404);
}
