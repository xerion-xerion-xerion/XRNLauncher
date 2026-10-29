// XRNPrime: server-owned billing, grants and cosmetic-only privileges.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
const key=(mode,uuid)=>'prime:member:'+mode+':'+uuid;
const enabled=env=>env.XRN_PRIME_ENABLED==='true';
const admin=(env,uuid)=>/^[a-f0-9]{32}$/.test(env.XRN_GIFT_ADMIN_UUID||'')&&uuid===env.XRN_GIFT_ADMIN_UUID;
const id=(value,prefix)=>typeof value==='string'&&new RegExp('^'+prefix+'_[A-Za-z0-9]+$').test(value);
export const PRIME={name:'XRNPrime',amount:499,currency:'eur',interval:'month',imports:2,windowMs:7*86400000,presets:5};
export async function primeStatus(store,env,mode,uuid,now=Date.now()){
 const data=await store.get(key(mode,uuid))||{},paid=data.billing?.active===true&&data.billing.until>now&&data.billing.checkedAt>now-300000,gift=data.giftUntil>now;
 const active=enabled(env)&&(paid||gift);return {active,until:active?Math.max(paid?data.billing.until:0,gift?data.giftUntil:0):0,source:paid?'stripe':gift?'gift':'none',cancelAtPeriodEnd:!!data.billing?.cancelAtPeriodEnd,subscriptionStatus:data.billing?.status||'none',hasSubscription:!!data.subscription,canCancel:!!data.subscription&&!['canceled','incomplete_expired'].includes(data.billing?.status)&&!data.billing?.cancelAtPeriodEnd};
}
export async function primeStyle(store,env,mode,uuid,style){const p=await primeStatus(store,env,mode,uuid);return {...style,animate:p.active&&style.animate===true,rainbow:p.active&&style.rainbow===true};}
async function body(request,payload,max=4096){const b=JSON.parse(new TextDecoder().decode(await payload(request,max)));if(!b||typeof b!=='object'||Array.isArray(b))throw Error('invalid_body');return b;}
const fields=(b,keys)=>!Object.keys(b).some(k=>!keys.includes(k));
const origin=env=>{const u=new URL(env.XRN_SHOP_RETURN_ORIGIN);if(u.protocol!=='https:'||u.username||u.password)throw Error('return_origin');return u.origin;};
function safeURL(raw,host){const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!==host||u.username||u.password)throw Error('stripe_url');return u.href;}
export async function refreshPrime(store,env,mode,uuid,stripe){
 const member=await store.get(key(mode,uuid));if(!member?.subscription)return primeStatus(store,env,mode,uuid);
 const seq=await store.transaction(async tx=>{const m=await tx.get(key(mode,uuid));m.sequence=(m.sequence||0)+1;await tx.put(key(mode,uuid),m);return m.sequence;});
 const sub=await stripe(env,'subscriptions/'+encodeURIComponent(member.subscription)),items=sub.items?.data||[],item=items[0],price=item?.price;
 if(sub.id!==member.subscription||sub.livemode!==(mode==='live')||sub.metadata?.xrn_kind!=='prime'||sub.metadata?.xrn_uuid!==uuid||sub.metadata?.xrn_order!==member.order||sub.customer!==member.customer||items.length!==1||sub.items?.has_more||item.quantity!==1||price?.id!==env.XRN_PRIME_PRICE_ID||price.unit_amount!==499||price.currency!=='eur'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)throw Error('subscription_mismatch');
 let active=false,until=0,invoiceId=typeof sub.latest_invoice==='string'?sub.latest_invoice:sub.latest_invoice?.id;
 if(sub.status==='active'&&id(invoiceId,'in')){
  const invoice=await stripe(env,'invoices/'+encodeURIComponent(invoiceId)+'?expand[]=payments'),lines=invoice.lines?.data||[],line=lines[0],payments=invoice.payments?.data||[];
  if(invoice.id!==invoiceId||invoice.livemode!==(mode==='live')||invoice.customer!==member.customer||invoice.parent?.subscription_details?.subscription!==sub.id||invoice.currency!=='eur'||lines.length!==1||invoice.lines?.has_more||(line.pricing?.price_details?.price||line.price?.id)!==env.XRN_PRIME_PRICE_ID||line.quantity!==1)throw Error('invoice_mismatch');
  if(invoice.status==='paid'&&invoice.amount_paid===499&&invoice.amount_due===499&&invoice.amount_remaining===0&&!invoice.payments?.has_more&&payments.length===1){
   const payment=payments[0],piId=typeof payment.payment?.payment_intent==='string'?payment.payment.payment_intent:payment.payment?.payment_intent?.id,pi=id(piId,'pi')?await stripe(env,'payment_intents/'+encodeURIComponent(piId)+'?expand[]=latest_charge'):null,charge=pi?.latest_charge;
   active=payment.status==='paid'&&payment.amount_paid===499&&payment.currency==='eur'&&pi?.status==='succeeded'&&pi.livemode===(mode==='live')&&pi.currency==='eur'&&pi.amount===499&&pi.amount_received===499&&charge?.paid===true&&charge.livemode===(mode==='live')&&charge.currency==='eur'&&charge.amount===499&&!charge.disputed&&!charge.refunded&&charge.amount_refunded===0;
   if(active){const end=Number(item.current_period_end),start=Number(item.current_period_start);if(!Number.isSafeInteger(end)||!Number.isSafeInteger(start)||end<=start||end-start>32*86400||line.period?.start!==start||line.period?.end!==end)throw Error('period_mismatch');until=end*1000;active=until>Date.now();await store.put('prime:invoice:'+mode+':'+invoiceId,uuid);if(id(pi?.id,'pi'))await store.put('prime:pi:'+mode+':'+pi.id,uuid);}
  }
 }
 await store.transaction(async tx=>{const m=await tx.get(key(mode,uuid));if(m.sequence!==seq||m.subscription!==sub.id)return;m.billing={active,until,status:sub.status,invoice:invoiceId,cancelAtPeriodEnd:sub.cancel_at_period_end===true,checkedAt:Date.now()};await tx.put(key(mode,uuid),m);});
 return primeStatus(store,env,mode,uuid);
}
async function checkout(request,directory,ctx){
 const {store,env}=directory,{uuid,mode,stripe,payload}=ctx,b=await body(request,payload);if(env.XRN_PRIME_PUBLIC!=='true'&&!admin(env,uuid))return json({error:'prime_not_launched'},503);if(mode==='live'&&!env.STRIPE_PRIME_WEBHOOK_SECRET)return json({error:'prime_unconfigured'},503);if(!fields(b,[]))return json({error:'invalid_order'},400);
 if(!id(env.XRN_PRIME_PRICE_ID,'price'))return json({error:'prime_unconfigured'},503);
 await finishPrimeCheckout(store,env,mode,uuid,stripe);const existing=await store.get(key(mode,uuid));if(existing?.subscription&&existing.billing&&!['canceled','incomplete_expired'].includes(existing.billing.status))return json({error:'subscription_exists'},409);const status=await primeStatus(store,env,mode,uuid);if(status.active)return json({error:'already_prime'},409);
 const now=Date.now(),pending=await store.transaction(async tx=>{const old=await tx.get('prime:pending:'+mode+':'+uuid);if(old&&old.until>now)return old;const o={order:random(),uuid,until:now+3600000};await tx.put('prime:pending:'+mode+':'+uuid,o);return o;});
 if(pending.url)return json({order:pending.order,url:pending.url,mode});
 const form=new URLSearchParams({mode:'subscription','payment_method_types[0]':'card','line_items[0][price]':env.XRN_PRIME_PRICE_ID,'line_items[0][quantity]':'1',client_reference_id:pending.order,'metadata[xrn_kind]':'prime','metadata[xrn_uuid]':uuid,'metadata[xrn_order]':pending.order,'subscription_data[metadata][xrn_kind]':'prime','subscription_data[metadata][xrn_uuid]':uuid,'subscription_data[metadata][xrn_order]':pending.order,success_url:origin(env)+'/v2/shop/return?prime=1&result=success',cancel_url:origin(env)+'/v2/shop/return?prime=1&result=cancel',expires_at:String(Math.floor(pending.until/1000)),locale:'fr','managed_payments[enabled]':'false'});
 const session=await stripe(env,'checkout/sessions','POST',form,'xrn-prime-'+mode+'-'+pending.order);const url=safeURL(session.url,'checkout.stripe.com');
 if(!id(session.id,'cs_'+mode)||session.livemode!==(mode==='live')||session.mode!=='subscription'||session.metadata?.xrn_uuid!==uuid||session.metadata?.xrn_order!==pending.order||session.client_reference_id!==pending.order)throw Error('checkout_mismatch');
 await store.transaction(async tx=>{const o=await tx.get('prime:pending:'+mode+':'+uuid);if(o?.order!==pending.order)throw Error('pending_changed');Object.assign(o,{session:session.id,url});await tx.put('prime:pending:'+mode+':'+uuid,o);await tx.put('prime:session:'+mode+':'+session.id,uuid);});return json({order:pending.order,url,mode});
}
export async function finishPrimeCheckout(store,env,mode,uuid,stripe){
 const o=await store.get('prime:pending:'+mode+':'+uuid);if(!o?.session)return refreshPrime(store,env,mode,uuid,stripe);
 const session=await stripe(env,'checkout/sessions/'+encodeURIComponent(o.session)+'?expand[]=line_items');const lines=session.line_items?.data||[];
 if(session.id!==o.session||session.livemode!==(mode==='live')||session.mode!=='subscription'||session.metadata?.xrn_kind!=='prime'||session.metadata?.xrn_uuid!==uuid||session.metadata?.xrn_order!==o.order||session.client_reference_id!==o.order||lines.length!==1||session.line_items?.has_more||lines[0].quantity!==1||lines[0].price?.id!==env.XRN_PRIME_PRICE_ID||lines[0].price?.unit_amount!==499||lines[0].price?.currency!=='eur')throw Error('checkout_mismatch');
 if(session.status==='expired'){await store.transaction(async tx=>{const current=await tx.get('prime:pending:'+mode+':'+uuid);if(current?.session===session.id)await tx.delete('prime:pending:'+mode+':'+uuid);});return refreshPrime(store,env,mode,uuid,stripe);}
 if(session.status==='complete'&&session.payment_status==='paid'&&id(session.subscription,'sub')&&id(session.customer,'cus')){
  await store.transaction(async tx=>{const m=await tx.get(key(mode,uuid))||{};if(m.subscription&&m.subscription!==session.subscription&&m.billing?.active&&m.billing.until>Date.now())throw Error('duplicate_subscription');Object.assign(m,{subscription:session.subscription,customer:session.customer,order:o.order});await tx.put(key(mode,uuid),m);await tx.put('prime:sub:'+mode+':'+session.subscription,uuid);await tx.delete('prime:pending:'+mode+':'+uuid);});
 }
 return refreshPrime(store,env,mode,uuid,stripe);
}
async function digest(code,env){if((env.XRN_GIFT_PEPPER||'').length<32)throw Error('prime_codes_unconfigured');const e=new TextEncoder(),k=await crypto.subtle.importKey('raw',e.encode(env.XRN_GIFT_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(new Uint8Array(await crypto.subtle.sign('HMAC',k,e.encode('prime:'+code))));}
const normalize=value=>typeof value==='string'?value.trim().toUpperCase().replace(/[\s-]/g,''):'';
async function gifts(request,directory,ctx,action){
 const {store,env}=directory,{uuid,mode,payload}=ctx,b=await body(request,payload),isAdmin=admin(env,uuid),now=Date.now();
 if(action==='redeem'){
  if(!fields(b,['code'])||!/^[A-Z0-9]{20,80}$/.test(normalize(b.code)))return json({error:'invalid_code'},400);
  const k='prime:code:'+mode+':'+await digest(normalize(b.code),env);
  const result=await store.transaction(async tx=>{const g=await tx.get(k);if(!g||g.state!=='ready'||g.expiresAt<=now||g.recipient&&g.recipient!==uuid)return {error:'invalid_or_used_code'};const status=await primeStatus(tx,env,mode,uuid);if(status.active)return {error:'already_prime'};if(status.hasSubscription&&!['canceled','incomplete_expired'].includes(status.subscriptionStatus))return {error:'subscription_exists'};const m=await tx.get(key(mode,uuid))||{};m.giftUntil=now+g.days*86400000;await tx.put(key(mode,uuid),m);g.state='used';g.usedBy=uuid;g.usedAt=now;await tx.put(k,g);return {ok:true,until:m.giftUntil};});return json(result,result.error?409:200);
 }
 if(!isAdmin)return json({error:'admin_required'},403);
 if(action==='create'){
  if(!fields(b,['days','recipient','prefix'])||!Number.isInteger(b.days)||b.days<1||b.days>365||(b.recipient&&!/^[a-f0-9]{32}$/.test(b.recipient)))return json({error:'invalid_grant'},400);
  const prefix=normalize(b.prefix||'PRIME');if(!/^[A-Z0-9]{1,12}$/.test(prefix))return json({error:'invalid_prefix'},400);const code=prefix+'-'+random().toUpperCase(),hash=await digest(normalize(code),env),g={id:random(),state:'ready',days:b.days,recipient:b.recipient||'',createdAt:now,expiresAt:now+30*86400000,createdBy:uuid};
  await store.transaction(async tx=>{const k='prime:code:'+mode+':'+hash;await tx.put(k,g);await tx.put('prime:gift-id:'+mode+':'+g.id,k);await tx.put('prime:gift-list:'+mode+':'+now+':'+g.id,k);});return json({code,id:g.id,days:g.days,expiresAt:g.expiresAt});
 }
 if(action==='list'){if(!fields(b,[]))return json({error:'invalid_request'},400);const entries=await store.list({prefix:'prime:gift-list:'+mode+':',reverse:true,limit:50}),codes=[];for(const k of entries.values()){const g=await store.get(k);if(g)codes.push({id:g.id,state:g.state==='ready'&&g.expiresAt<=now?'expired':g.state,days:g.days,expiresAt:g.expiresAt,createdAt:g.createdAt,usedBy:g.usedBy||'',recipient:g.recipient});}return json({codes});}
 if(action==='revoke'){if(!fields(b,['id'])||!/^[a-f0-9]{32}$/.test(b.id||''))return json({error:'invalid_id'},400);const ok=await store.transaction(async tx=>{const k=await tx.get('prime:gift-id:'+mode+':'+b.id),g=k&&await tx.get(k);if(!g||g.state!=='ready')return false;g.state='revoked';await tx.put(k,g);return true;});return json({ok},ok?200:409);}
 return json({error:'not_found'},404);
}
export async function primeWebhook(request,directory,ctx){
 const {store,env}=directory,{mode,payload,verifyWebhook,stripe}=ctx,raw=await payload(request,65536);
 if(!await verifyWebhook(raw,request.headers.get('Stripe-Signature'),env.STRIPE_PRIME_WEBHOOK_SECRET||env.STRIPE_WEBHOOK_SECRET))return json({error:'invalid_signature'},400);
 const event=JSON.parse(new TextDecoder().decode(raw));if(event.livemode!==(mode==='live')||!/^evt_[A-Za-z0-9]+$/.test(event.id||''))return json({error:'invalid_event'},400);const o=event.data?.object;if(!o)return json({error:'invalid_event'},400);
 let uuid='';if(event.type.startsWith('checkout.session.'))uuid=await store.get('prime:session:'+mode+':'+o.id);else if(event.type.startsWith('customer.subscription.'))uuid=await store.get('prime:sub:'+mode+':'+o.id);else if(event.type.startsWith('invoice.'))uuid=await store.get('prime:sub:'+mode+':'+(o.parent?.subscription_details?.subscription||o.subscription));else if(['charge.refunded','charge.dispute.created','charge.dispute.closed'].includes(event.type)){const pi=typeof o.payment_intent==='string'?o.payment_intent:o.payment_intent?.id;uuid=pi&&await store.get('prime:pi:'+mode+':'+pi);}
 if(!uuid)return json({ok:true,ignored:true});await finishPrimeCheckout(store,env,mode,uuid,stripe);return json({ok:true});
}
export async function handlePrime(request,directory,ctx){
 const {store,env}=directory,{uuid,mode,stripe,payload}=ctx,path=new URL(request.url).pathname,action=path.slice('/v2/shop/prime/'.length);
 if(!enabled(env))return json({error:'prime_not_launched'},503);
 try{
  if(action==='webhook')return primeWebhook(request,directory,ctx);
  if(action.startsWith('gifts/'))return gifts(request,directory,ctx,action.slice(6));
  if(action==='checkout')return checkout(request,directory,ctx);
  if(action==='status'){const b=await body(request,payload);if(!fields(b,[]))return json({error:'invalid_request'},400);const m=await store.get(key(mode,uuid));if(m?.subscription&&(!m.billing?.checkedAt||m.billing.checkedAt<Date.now()-60000)||await store.get('prime:pending:'+mode+':'+uuid))await finishPrimeCheckout(store,env,mode,uuid,stripe);const status=await primeStatus(store,env,mode,uuid);return json({...status,...PRIME,canGenerate:admin(env,uuid),uploadsConfigured:true});}
  if(action==='cancel'){const b=await body(request,payload);if(!fields(b,[]))return json({error:'invalid_request'},400);const m=await store.get(key(mode,uuid));if(!m?.subscription)return json({error:'no_subscription'},409);await stripe(env,'subscriptions/'+encodeURIComponent(m.subscription),'POST',new URLSearchParams({cancel_at_period_end:'true'}));return json(await refreshPrime(store,env,mode,uuid,stripe));}
  if(action.startsWith('outfits/')){
   const b=await body(request,payload),sub=action.slice(8),prefix='prime:outfit:'+mode+':'+uuid+':';
   if(sub==='list'){if(!fields(b,[]))return json({error:'invalid_request'},400);const rows=await store.list({prefix,limit:5});return json({outfits:[...rows.values()]});}
   if(!(await primeStatus(store,env,mode,uuid)).active)return json({error:'prime_required'},403);
   if(!Number.isInteger(b.slot)||b.slot<1||b.slot>5)return json({error:'invalid_slot'},400);
   if(sub==='delete'){if(!fields(b,['slot']))return json({error:'invalid_request'},400);await store.delete(prefix+b.slot);return json({ok:true});}
   const rights=await directory.rights(uuid);
   if(sub==='save'){
    const st=b.style,valid=st&&fields(st,['enabled','badge','gradient','animate','rainbow','start','end'])&&['start','end'].every(k=>Number.isInteger(st[k])&&st[k]>=0&&st[k]<=0xffffff)&&['enabled','badge','gradient','animate','rainbow'].every(k=>typeof st[k]==='boolean');
    if(!fields(b,['slot','name','cosmetic','style'])||typeof b.name!=='string'||!b.name.trim()||b.name.length>40||/[\x00-\x1f\x7f]/.test(b.name)||!valid||typeof b.cosmetic!=='string'||b.cosmetic&&!rights.includes(b.cosmetic))return json({error:'invalid_outfit'},400);
    const outfit={slot:b.slot,name:b.name.trim(),cosmetic:b.cosmetic,style:st};await store.put(prefix+b.slot,outfit);return json({ok:true,outfit});
   }
   if(sub==='equip'){if(!fields(b,['slot']))return json({error:'invalid_request'},400);const outfit=await store.get(prefix+b.slot);if(!outfit||outfit.cosmetic&&!rights.includes(outfit.cosmetic))return json({error:'outfit_unavailable'},409);const p=await store.get('p:'+uuid);if(p){p.style=outfit.style;p.cosmetic=outfit.cosmetic;await store.put('p:'+uuid,p);}return json({outfit});}
   return json({error:'not_found'},404);
  }
  if(action.startsWith('capes/')){const {handlePrimeCapes}=await import('./prime-assets.mjs');return handlePrimeCapes(request,directory,ctx,action.slice(6));}
  return json({error:'not_found'},404);
 }catch(e){console.warn('prime_operation_failed',action,e.name);return json({error:'prime_verification_failed'},502);}
}
