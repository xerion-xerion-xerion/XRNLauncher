import {handlePrime} from './prime.mjs';
import {servePrimeCape} from './prime-assets.mjs';
// The client supplies a product ID only. Prices, Minecraft identity, quantity,
// Stripe account/mode and ownership are authoritative server-side values.
import {handleGifts,giftRights} from './gifts.mjs';
export const PRODUCTS=Object.freeze([
 {id:'cape_job',name:'Job Application',amount:0},
 {id:'cape_space',name:'Singularité',amount:299},
 {id:'cape_scream',name:'Scream',amount:199},
 {id:'cape_spine',name:'Spine',amount:199},
 {id:'cape_crimson',name:'Crimson Knight',amount:199},
 {id:'cape_eclipse',name:'Éclipse',amount:199},
 {id:'cape_rose',name:'Rose blanche',amount:199},
 {id:'cape_seraphine',name:'Séraphine',amount:199},
 {id:'cape_moonlight',name:'Clair de lune',amount:199}
]);
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const enc=new TextEncoder(),hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(20)));
const hash=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))));
const product=id=>PRODUCTS.find(p=>p.id===id),orderKey=(uuid,id)=>'shop:order:'+uuid+':'+id;
export function mode(env){
 if(env.XRN_SHOP_MODE==='test'&&/^sk_test_\S+$/.test(env.STRIPE_SECRET_KEY||''))return 'test';
 if(env.XRN_SHOP_MODE==='live'&&env.XRN_ALLOW_LIVE==='true'&&/^sk_live_\S+$/.test(env.STRIPE_SECRET_KEY||'')&&/^whsec_\S+$/.test(env.STRIPE_WEBHOOK_SECRET||'')){
  try{const u=new URL(env.XRN_SHOP_RETURN_ORIGIN);if(u.protocol==='https:'&&!u.username&&!u.password&&PRODUCTS.some(p=>p.amount>0&&String(env.XRN_LIVE_PRODUCT_IDS||'').split(',').includes(p.id)))return 'live';}catch{}
 }
 return 'disabled';
}
export function enabled(env){return mode(env)!=='disabled';}
function sellable(env,p){return !!(p&&p.amount>0&&enabled(env)&&(mode(env)==='test'||String(env.XRN_LIVE_PRODUCT_IDS||'').split(',').includes(p.id)));}
export async function purchaseRights(store,env,uuid){return enabled(env)?[...new Set([...(await store.get('shop:ent:'+mode(env)+':'+uuid)||[]),...await giftRights(store,mode(env),uuid)])]:[];}
async function payload(request,max=4096){
 const reader=request.body?.getReader();if(!reader)throw Error('body');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('body');}chunks.push(value);}
 const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}return bytes;
}
async function stripe(env,path,method='GET',data,key){
 if(!enabled(env))throw Error('shop_disabled');
 const headers={Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':'2025-03-31.basil'};
 if(data)headers['Content-Type']='application/x-www-form-urlencoded';if(key)headers['Idempotency-Key']=key;
 const res=await fetch('https://api.stripe.com/v1/'+path,{method,headers,body:data?.toString(),redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!res.ok){let error={};try{error=(await res.json()).error||{};}catch{}console.warn('stripe_request_failed',res.status,String(error.code||'').slice(0,80),String(error.param||'').slice(0,120),String(error.message||error).replace(/(?:sk_test_|sk_live_|whsec_)[A-Za-z0-9_]+/g,'[secret]').slice(0,200));throw Error('stripe_unavailable');}
 return res.json();
}
async function identity(request,store){
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!/^[a-f0-9]{64}$/.test(token))return null;
 const s=await store.get('s:'+await hash(token));
 // Payments require the stronger v2 certificate session, never legacy v1.
 return s&&/^[a-f0-9]{32}$/.test(s.uuid)&&s.until>Date.now()&&s.certificateExpiresAt>Date.now()?s.uuid:null;
}
function checkoutURL(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='checkout.stripe.com'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function returnOrigin(request,env){
 const u=new URL(request.url);const configured=env.XRN_SHOP_RETURN_ORIGIN;
 if(configured){const fixed=new URL(configured);if(fixed.protocol!=='https:')throw Error('return_origin');return fixed.origin;}
 // Local test only, never trust a supplied Host for a production return URL.
 if(['127.0.0.1','localhost'].includes(u.hostname)&&u.protocol==='http:')return u.origin;
 throw Error('return_origin');
}
async function create(request,uuid,store,env){
 const b=JSON.parse(new TextDecoder().decode(await payload(request)));
 if(!b||Object.keys(b).some(k=>k!=='product'))return json({error:'invalid_order'},400);
 const p=product(b.product);if(!sellable(env,p))return json({error:'invalid_product'},400);
 const shopMode=mode(env),root=returnOrigin(request,env),now=Date.now(),slot='shop:pending:'+shopMode+':'+uuid+':'+p.id;
 const result=await store.transaction(async tx=>{
  if((await purchaseRights(tx,env,uuid)).includes(p.id)||(await tx.get('e:'+uuid)||[]).includes(p.id))return {owned:true};
  const previous=await tx.get(slot),old=previous&&await tx.get(orderKey(uuid,previous));
  if(old&&old.amount===p.amount&&old.expiresAt>now&&['creating','open','paid'].includes(old.state))return {order:old};
  const order={id:random(),uuid,product:p.id,amount:p.amount,currency:'eur',mode:shopMode,state:'creating',createdAt:now,expiresAt:now+3600000};
  await tx.put(orderKey(uuid,order.id),order);await tx.put(slot,order.id);await tx.put('shop:index:'+order.id,uuid);return {order};
 });
 if(result.owned)return json({error:'already_owned'},409);
 const order=result.order;if(order.state==='paid')return json({error:'already_owned'},409);
 if(order.session&&order.url)return json({order:order.id,url:order.url,test:shopMode==='test',mode:shopMode});
 const form=new URLSearchParams({mode:'payment','payment_method_types[0]':'card','line_items[0][quantity]':'1','line_items[0][price_data][currency]':'eur','line_items[0][price_data][unit_amount]':String(order.amount),'line_items[0][price_data][product_data][name]':'XRN — '+p.name,client_reference_id:order.id,'metadata[xrn_order]':order.id,'metadata[xrn_uuid]':uuid,'metadata[xrn_product]':p.id,'payment_intent_data[metadata][xrn_order]':order.id,success_url:root+'/v2/shop/return?result=success',cancel_url:root+'/v2/shop/return?result=cancel',expires_at:String(Math.floor(order.expiresAt/1000)),locale:'fr'});
 // Standard Checkout for this private sandbox. This is per-session only and
 // never changes the merchant account's Managed Payments configuration.
 form.set('managed_payments[enabled]','false');
 const checkout=await stripe(env,'checkout/sessions','POST',form,'xrn-'+shopMode+'-order-2-'+order.id);
 const url=checkoutURL(checkout.url);
 if(checkout.livemode!==(shopMode==='live')||!new RegExp('^cs_'+shopMode+'_[A-Za-z0-9]+$').test(checkout.id||'')||!url||checkout.metadata?.xrn_order!==order.id)throw Error('checkout_invalid');
 await store.transaction(async tx=>{const stored=await tx.get(orderKey(uuid,order.id));if(!stored||stored.state!=='creating')return;stored.session=checkout.id;stored.url=url;stored.state='open';await tx.put(orderKey(uuid,order.id),stored);await tx.put('shop:session:'+checkout.id,order.id);});
 return json({order:order.id,url,test:shopMode==='test',mode:shopMode});
}
// No redirects or client success flags can call this with payment data. Every
// reconciliation retrieves the current Checkout and PaymentIntent from Stripe.
export async function reconcile(store,env,uuid,id){
 let order=await store.get(orderKey(uuid,id));if(!order||order.mode!==mode(env))return null;const live=order.mode==='live';
 if(!order.session)return {order:id,product:order.product,state:order.state,test:!live};
 const checkout=await stripe(env,'checkout/sessions/'+encodeURIComponent(order.session)+'?expand[]=line_items&expand[]=payment_intent.latest_charge');
 const p=product(order.product),lines=checkout.line_items?.data||[],pi=checkout.payment_intent;
 if(checkout.id!==order.session||checkout.livemode!==live||checkout.client_reference_id!==id||checkout.metadata?.xrn_order!==id||checkout.metadata?.xrn_uuid!==uuid||checkout.metadata?.xrn_product!==order.product||checkout.mode!=='payment'||checkout.currency!=='eur'||checkout.amount_total!==order.amount||!p||!Number.isInteger(order.amount)||order.amount<=0||lines.length!==1||checkout.line_items?.has_more||lines[0].quantity!==1||lines[0].price?.unit_amount!==order.amount||lines[0].price?.currency!=='eur')throw Error('payment_mismatch');
 let state=checkout.status==='expired'?'expired':'open';
 if(checkout.payment_status==='paid'&&checkout.status==='complete'){
  if(!pi||typeof pi!=='object'||pi.livemode!==live||pi.status!=='succeeded'||pi.currency!=='eur'||pi.amount!==order.amount||pi.amount_received!==order.amount||pi.metadata?.xrn_order!==id||!pi.latest_charge||typeof pi.latest_charge!=='object')throw Error('payment_mismatch');
  const charge=pi.latest_charge;
  state=charge.disputed===true||charge.refunded===true||charge.amount_refunded>0?'revoked':'paid';
 }
 await store.transaction(async tx=>{
  const current=await tx.get(orderKey(uuid,id));if(!current||current.session!==checkout.id)throw Error('order_changed');
  if(current.state==='revoked')state='revoked'; // A stale concurrent poll cannot restore a refunded purchase.
  current.state=state;current.checkedAt=Date.now();if(state==='paid')current.paidAt=current.paidAt||Date.now();
  if(pi?.id){current.paymentIntent=pi.id;await tx.put('shop:pi:'+pi.id,id);}
  await tx.put(orderKey(uuid,id),current);
  const proofKey='shop:paid:'+order.mode+':'+uuid+':'+order.product,proofs=new Set(await tx.get(proofKey)||[]);
  if(state==='paid')proofs.add(id);else proofs.delete(id);await tx.put(proofKey,[...proofs]);
  const owned=[];for(const item of PRODUCTS)if(item.amount>0&&(await tx.get('shop:paid:'+order.mode+':'+uuid+':'+item.id)||[]).length)owned.push(item.id);
  await tx.put('shop:ent:'+order.mode+':'+uuid,owned);
  if(state==='revoked'){
   const player=await tx.get('p:'+uuid);if(player?.cosmetic===order.product){player.cosmetic='';await tx.put('p:'+uuid,player);}
  }
 });
 return {order:id,product:order.product,state,test:!live};
}
export async function verifyWebhook(raw,header,secret,now=Date.now()){
 if(!secret||!header||header.length>2048)return false;
 const entries=header.split(',').map(p=>p.split('=')),timestamps=entries.filter(([k])=>k==='t'),signatures=entries.filter(([k])=>k==='v1').map(([,v])=>v);
 if(timestamps.length!==1||!/^\d{10,12}$/.test(timestamps[0][1]))return false;
 const time=Number(timestamps[0][1]);if(Math.abs(now/1000-time)>300)return false;
 const prefix=enc.encode(time+'.'),message=new Uint8Array(prefix.length+raw.length);message.set(prefix);message.set(raw,prefix.length);
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const signature of signatures){if(!/^[a-f0-9]{64}$/i.test(signature))continue;const bytes=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));if(await crypto.subtle.verify('HMAC',key,bytes,message))return true;}
 return false;
}
async function webhook(request,store,env){
 const raw=await payload(request,65536);
 if(!await verifyWebhook(raw,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET))return json({error:'invalid_signature'},400);
 const event=JSON.parse(new TextDecoder().decode(raw));if(event.livemode!==(mode(env)==='live')||!/^evt_[A-Za-z0-9]+$/.test(event.id||''))return json({error:'invalid_event'},400);
 const supported=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','charge.refunded','charge.dispute.created','charge.dispute.closed'];
 if(!supported.includes(event.type))return json({ok:true,ignored:true});
 const obj=event.data?.object;if(!obj)return json({error:'invalid_event'},400);
 const checkoutEvent=event.type.startsWith('checkout.session.');
 let id=checkoutEvent?await store.get('shop:session:'+obj.id):await store.get('shop:pi:'+(typeof obj.payment_intent==='string'?obj.payment_intent:obj.payment_intent?.id));
 // The event may arrive before the browser's first status poll.
 if(!id&&!checkoutEvent&&obj.payment_intent){const pi=await stripe(env,'payment_intents/'+encodeURIComponent(typeof obj.payment_intent==='string'?obj.payment_intent:obj.payment_intent.id));id=pi.metadata?.xrn_order;}
 const uuid=id&&await store.get('shop:index:'+id);if(!uuid)return json({ok:true,ignored:true});
 await reconcile(store,env,uuid,id);return json({ok:true});
}
export async function handleShop(request,directory){
 const {store,env}=directory,u=new URL(request.url);
 if(u.pathname==='/v2/shop/return'&&request.method==='GET')return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>XRN — Paiement de test</title><body style="background:#17131e;color:#eee;font:16px system-ui;padding:10vw"><h1>Retournez dans XRN Launcher</h1><p>Le launcher vérifie le paiement auprès de Stripe avant de débloquer la cape.</p><p>${mode(env)==='live'?'Votre cape apparaît après confirmation du paiement.':'Atelier de test : aucun achat réel.'}</p></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'}});
 if(u.pathname==='/v2/shop/catalogue'&&request.method==='GET')return json({mode:mode(env),products:PRODUCTS.map(p=>({...p,currency:'eur',purchasable:sellable(env,p)}))});
 if(!enabled(env))return json({error:'shop_disabled'},503);
 if(mode(env)==='live'&&u.origin!==new URL(env.XRN_SHOP_RETURN_ORIGIN).origin)return json({error:'origin_refused'},403);
 try{
  if(u.pathname==='/v2/shop/webhook'&&request.method==='POST')return await webhook(request,store,env);
  if(u.pathname==='/v2/shop/prime/webhook'&&request.method==='POST')return await handlePrime(request,directory,{mode:mode(env),stripe,verifyWebhook,payload});
  if(u.pathname.startsWith('/v2/shop/prime-texture/')&&request.method==='GET')return await servePrimeCape(request,directory,mode(env),await identity(request,store)||'');
  const uuid=await identity(request,store);if(!uuid)return json({error:'session_required'},401);
  if(request.method!=='POST')return json({error:'method'},405);
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  if(!await directory.rate(uuid+':'+ip,u.pathname, u.pathname.endsWith('checkout')?8:30))return json({error:'rate_limit'},429);
  if(u.pathname.startsWith('/v2/shop/prime/'))return await handlePrime(request,directory,{uuid,mode:mode(env),stripe,verifyWebhook,payload});
  if(u.pathname.startsWith('/v2/shop/gifts/'))return await handleGifts(request,directory,{uuid,mode:mode(env),products:PRODUCTS.filter(p=>p.amount===0||sellable(env,p))});
  if(u.pathname==='/v2/shop/checkout')return await create(request,uuid,store,env);
  if(u.pathname==='/v2/shop/status'){
   const b=JSON.parse(new TextDecoder().decode(await payload(request)));if(!b||Object.keys(b).some(k=>k!=='order')||!/^[a-f0-9]{40}$/.test(b.order||''))return json({error:'invalid_order'},400);
   const state=await reconcile(store,env,uuid,b.order);return state?json(state):json({error:'not_found'},404);
  }
  if(u.pathname==='/v2/shop/orders'){
   const orders=await store.list({prefix:'shop:order:'+uuid+':',limit:100});
   return json({orders:[...orders.values()].filter(o=>o.mode===mode(env)).sort((a,b)=>b.createdAt-a.createdAt).map(o=>({order:o.id,product:o.product,state:o.state,test:o.mode==='test'}))});
  }
  return json({error:'not_found'},404);
 }catch(error){console.warn('shop_operation_failed',u.pathname,error.name,String(error.message).replace(/(?:sk_test_|sk_live_|whsec_)[A-Za-z0-9_]+/g,'[secret]').slice(0,200));return json({error:['shop_disabled','stripe_unavailable'].includes(error.message)?error.message:'payment_verification_failed'},502);}
}
