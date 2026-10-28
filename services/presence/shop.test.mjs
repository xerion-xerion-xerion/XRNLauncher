import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {Directory} from './worker.mjs';
import {verifyWebhook,reconcile} from './shop.mjs';
class Store{
 data=new Map();queue=Promise.resolve();time=null;
 async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.data.set(k,structuredClone(v));}async delete(k){for(const n of Array.isArray(k)?k:[k])this.data.delete(n);}
 async list({prefix='',limit=10000}={}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}
 async getAlarm(){return this.time;}async setAlarm(t){this.time=t;}
 transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p;}
}
const store=new Store(),env={XRN_SHOP_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture_only',STRIPE_WEBHOOK_SECRET:'whsec_fixture_only'},directory=new Directory({storage:store},env),alice='a'.repeat(32),bob='b'.repeat(32),tokenA='a'.repeat(64),tokenB='b'.repeat(64);
const sha=s=>createHash('sha256').update(s).digest('hex');
for(const [uuid,token]of [[alice,tokenA],[bob,tokenB]])await store.put('s:'+sha(token),{uuid,until:Date.now()+3600000,certificateExpiresAt:Date.now()+3600000});
const sessions=new Map(),idempotency=new Map(),realFetch=globalThis.fetch;let created=0,requests=0;
function paid(s){s.status='complete';s.payment_status='paid';s.payment_intent={id:'pi_'+s.id,livemode:s.livemode,status:'succeeded',currency:'eur',amount:s.amount_total,amount_received:s.amount_total,metadata:{xrn_order:s.client_reference_id},latest_charge:{id:'ch_'+s.id,disputed:false,refunded:false,amount_refunded:0}};}
globalThis.fetch=async(url,opts={})=>{
 const u=new URL(url);assert.equal(u.origin,'https://api.stripe.com');assert.ok(['Bearer sk_test_fixture_only','Bearer sk_live_fixture_only'].includes(opts.headers.Authorization));const live=opts.headers.Authorization==='Bearer sk_live_fixture_only';requests++;
 if(u.pathname==='/v1/checkout/sessions'&&opts.method==='POST'){
  const f=new URLSearchParams(opts.body),key=opts.headers['Idempotency-Key'];if(idempotency.has(key))return Response.json(sessions.get(idempotency.get(key)));
  assert.equal(f.get('line_items[0][quantity]'),'1');const amount=f.get('metadata[xrn_product]')==='cape_space'?299:199;assert.equal(f.get('line_items[0][price_data][unit_amount]'),String(amount));assert.equal(f.get('line_items[0][price_data][currency]'),'eur');
  const id='cs_'+(live?'live':'test')+'_fixture'+(++created),order=f.get('metadata[xrn_order]'),s={id,url:'https://checkout.stripe.com/c/pay/'+id,livemode:live,status:'open',payment_status:'unpaid',mode:'payment',currency:'eur',amount_total:amount,client_reference_id:order,metadata:{xrn_order:order,xrn_uuid:f.get('metadata[xrn_uuid]'),xrn_product:f.get('metadata[xrn_product]')},line_items:{data:[{quantity:1,price:{unit_amount:amount,currency:'eur'}}],has_more:false}};
  sessions.set(id,s);idempotency.set(key,id);return Response.json(s);
 }
 const id=u.pathname.split('/').at(-1);assert.ok(sessions.has(id),'Only expected Stripe resources');return Response.json(sessions.get(id));
};
async function call(path,data,token=tokenA){const res=await directory.fetch(new Request('http://127.0.0.1:8789/v2/shop/'+path,{method:data===undefined?'GET':'POST',headers:{'CF-Connecting-IP':'test',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:res.status,body:await res.json()};}
function signedEvent(event,secret=env.STRIPE_WEBHOOK_SECRET,time=Math.floor(Date.now()/1000)){const raw=JSON.stringify(event),sig=createHmac('sha256',secret).update(time+'.'+raw).digest('hex');return {raw,header:'t='+time+',v1='+sig};}
async function event(data,secret){const {raw,header}=signedEvent(data,secret);const r=await directory.fetch(new Request('http://127.0.0.1:8789/v2/shop/webhook',{method:'POST',headers:{'Stripe-Signature':header},body:raw}));return {status:r.status,body:await r.json()};}
try{
 assert.equal((await call('catalogue')).body.products.length,5);
 assert.equal((await call('checkout',{product:'cape_space'},'')).status,401);
 const legacy='c'.repeat(64);await store.put('s:'+sha(legacy),{uuid:alice,until:Date.now()+3600000});assert.equal((await call('checkout',{product:'cape_space'},legacy)).status,401);
 for(const extra of [{uuid:bob},{amount:1},{quantity:5},{currency:'usd'},{rights:['cape_spine']}])assert.equal((await call('checkout',{product:'cape_space',...extra})).status,400);
 assert.equal((await call('checkout',{product:'cape_xrn'})).status,400);assert.equal((await call('checkout',{product:'cape_job'})).status,400);assert.equal(requests,0);
 // Separate IP counters to exercise concurrency rather than the abuse limiter.
 const direct=()=>directory.fetch(new Request('http://127.0.0.1:8789/v2/shop/checkout',{method:'POST',headers:{Authorization:'Bearer '+tokenA,'CF-Connecting-IP':crypto.randomUUID()},body:JSON.stringify({product:'cape_space'})})).then(r=>r.json());
 const checks=await Promise.all([direct(),direct(),direct()]);assert.ok(checks.every(c=>c.order===checks[0].order));assert.equal(created,1);
 const order=checks[0].order,s=[...sessions.values()][0];
 assert.equal((await call('status',{order},tokenB)).status,404);
 assert.equal((await call('status',{order,paid:true})).status,400);
 assert.equal((await call('status',{order})).body.state,'open');assert.deepEqual(await directory.rights(alice),['cape_job']);
 paid(s);s.line_items.data[0].quantity=2;assert.equal((await call('status',{order})).status,502);assert.deepEqual(await directory.rights(alice),['cape_job']);s.line_items.data[0].quantity=1;
 s.metadata.xrn_uuid=bob;assert.equal((await call('status',{order})).status,502);s.metadata.xrn_uuid=alice;
 s.amount_total=1;assert.equal((await call('status',{order})).status,502);s.amount_total=299;
 const evt={id:'evt_paid',livemode:false,type:'checkout.session.completed',data:{object:{id:s.id}}};
 assert.equal((await event(evt,'whsec_wrong')).status,400);assert.deepEqual(await directory.rights(alice),['cape_job']);
 const stale=signedEvent(evt,env.STRIPE_WEBHOOK_SECRET,Math.floor(Date.now()/1000)-600);assert.equal(await verifyWebhook(new TextEncoder().encode(stale.raw),stale.header,env.STRIPE_WEBHOOK_SECRET),false);
 const valid=signedEvent(evt);assert.equal(await verifyWebhook(new TextEncoder().encode(valid.raw+' '),valid.header,env.STRIPE_WEBHOOK_SECRET),false);
 assert.equal((await event(evt)).status,200);assert.deepEqual(await directory.rights(alice),['cape_job','cape_space']);assert.deepEqual(await directory.rights(bob),['cape_job']);
 assert.equal((await event(evt)).status,200);assert.equal((await call('status',{order})).body.state,'paid');assert.deepEqual(await directory.rights(alice),['cape_job','cape_space']);
 assert.equal((await direct()).error,'already_owned');
 const live=new Directory({storage:store},{...env,XRN_SHOP_MODE:'live',STRIPE_SECRET_KEY:'sk_live_fixture_only'});assert.deepEqual(await live.rights(alice),['cape_job']);
 const disabled=await live.fetch(new Request('http://127.0.0.1:8789/v2/shop/checkout',{method:'POST',body:'{}'}));assert.equal(disabled.status,503);
 await store.put('p:'+alice,{uuid:alice,pseudo:'Alice',cosmetic:'cape_space',expiresAt:Date.now()+90000,style:{}});
 s.payment_intent.latest_charge.refunded=true;s.payment_intent.latest_charge.amount_refunded=299;
 assert.equal((await event({id:'evt_refund',livemode:false,type:'charge.refunded',data:{object:{payment_intent:s.payment_intent.id}}})).status,200);
 assert.deepEqual(await directory.rights(alice),['cape_job']);assert.equal((await store.get('p:'+alice)).cosmetic,'');
 s.payment_intent.latest_charge.refunded=false;s.payment_intent.latest_charge.amount_refunded=0;assert.equal((await reconcile(store,env,alice,order)).state,'revoked','Stale requests cannot regrant');
 await directory.alarm();assert.ok(await store.get('shop:order:'+alice+':'+order));assert.ok(await store.get('shop:session:'+s.id));
 const orders=await call('orders',{},tokenB);assert.deepEqual(orders.body.orders,[]);
 const cheap=await call('checkout',{product:'cape_spine'},tokenB);assert.equal(cheap.status,200);
 const cheapSession=[...sessions.values()].find(s=>s.metadata.xrn_product==='cape_spine');assert.equal(cheapSession.amount_total,199);paid(cheapSession);
 assert.equal((await call('status',{order:cheap.body.order},tokenB)).body.state,'paid');assert.deepEqual(await directory.rights(bob),['cape_job','cape_spine']);
 const catalogue=(await call('catalogue')).body.products;assert.equal(catalogue.find(p=>p.id==='cape_job').amount,0);assert.equal(catalogue.find(p=>p.id==='cape_space').amount,299);assert.ok(catalogue.filter(p=>!['cape_job','cape_space'].includes(p.id)).every(p=>p.amount===199));
 // A live key alone never activates charges; explicit gates and HTTPS are mandatory.
 const gates={...env,XRN_SHOP_MODE:'live',STRIPE_SECRET_KEY:'sk_live_fixture_only'};
 const {mode}=await import('./shop.mjs');assert.equal(mode(gates),'disabled');gates.XRN_ALLOW_LIVE='true';gates.XRN_SHOP_RETURN_ORIGIN='http://127.0.0.1:8789';gates.XRN_LIVE_PRODUCT_IDS='cape_spine';assert.equal(mode(gates),'disabled');gates.XRN_SHOP_RETURN_ORIGIN='https://shop.example.com';assert.equal(mode(gates),'live');
 const gated=new Directory({storage:store},gates);assert.deepEqual(await gated.rights(bob),['cape_job']);
 const wrongOrigin=await gated.fetch(new Request('http://127.0.0.1:8789/v2/shop/checkout',{method:'POST',headers:{Authorization:'Bearer '+tokenB},body:JSON.stringify({product:'cape_spine'})}));assert.equal(wrongOrigin.status,403);
 gates.XRN_LIVE_PRODUCT_IDS='cape_spine,cape_scream';
 const liveCall=async(path,data)=>{const r=await gated.fetch(new Request('https://shop.example.com/v2/shop/'+path,{method:'POST',headers:{Authorization:'Bearer '+tokenB},body:JSON.stringify(data)}));return {status:r.status,body:await r.json()};};
 const liveOrder=await liveCall('checkout',{product:'cape_scream'});assert.equal(liveOrder.status,200);assert.equal(liveOrder.body.test,false);assert.equal(liveOrder.body.mode,'live');
 const liveSession=[...sessions.values()].find(s=>s.livemode&&s.metadata.xrn_product==='cape_scream');paid(liveSession);
 assert.equal((await liveCall('status',{order:liveOrder.body.order})).body.state,'paid');
 assert.deepEqual(await gated.rights(bob),['cape_job','cape_scream']);assert.deepEqual(await directory.rights(bob),['cape_job','cape_spine']);
 const unapproved=await liveCall('checkout',{product:'cape_crimson'});assert.equal(unapproved.status,400);

 console.log('PASS Stripe security: authenticated UUID, server price/quantity, concurrent idempotency, account isolation, signed raw-body webhooks, replay/tamper rejection, exactly one cape, refunds, monotonic revocation, test/live separation, durable orders.');
}finally{globalThis.fetch=realFetch;}
