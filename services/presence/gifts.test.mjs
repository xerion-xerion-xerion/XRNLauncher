import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Directory} from './worker.mjs';
class Store{
 data=new Map();queue=Promise.resolve();async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.data.set(k,structuredClone(v));}async delete(k){for(const n of Array.isArray(k)?k:[k])this.data.delete(n);}async list({prefix='',limit=10000,reverse=false}={}){let a=[...this.data].filter(([k])=>k.startsWith(prefix)).sort(([a],[b])=>a.localeCompare(b));if(reverse)a.reverse();return new Map(a.slice(0,limit));}async getAlarm(){return null;}async setAlarm(){}transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p;}
}
const owner='a'.repeat(32),alice='b'.repeat(32),bob='c'.repeat(32),env={XRN_SHOP_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture_only',XRN_GIFT_ADMIN_UUID:owner,XRN_GIFT_PEPPER:'fixture-pepper-not-production-00000000000000000'},store=new Store(),d=new Directory({storage:store},env),sha=s=>createHash('sha256').update(s).digest('hex');
const tokens=new Map();for(const [i,uuid]of [owner,alice,bob].entries()){const token=String(i+1).repeat(64);tokens.set(uuid,token);await store.put('s:'+sha(token),{uuid,until:Date.now()+3600000,certificateExpiresAt:Date.now()+3600000});}
async function call(action,body={},uuid=owner){const r=await d.fetch(new Request('http://127.0.0.1:8789/v2/shop/gifts/'+action,{method:'POST',headers:{Authorization:'Bearer '+tokens.get(uuid),'CF-Connecting-IP':'fixture-'+uuid},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};}
async function clearRates(){for(const k of [...store.data.keys()])if(k.startsWith('r:'))store.data.delete(k);}
assert.equal((await call('status')).body.canGenerate,true);assert.equal((await call('status',{},alice)).body.canGenerate,false);
for(const action of ['create','list','revoke'])assert.equal((await call(action,{uuid:owner,developerMode:true},alice)).status,403);
assert.equal((await call('create',{code:'KOZO'})).body.error,'short_code_requires_recipient');
const gift=await call('create',{prefix:'Kozo'});assert.equal(gift.status,200);assert.equal(gift.body.choice,'one_premium_cape');assert.match(gift.body.code,/^KOZO-([0-9a-f]{4}-){7}[0-9a-f]{4}$/);
assert.ok(!JSON.stringify([...store.data]).includes(gift.body.code));assert.ok(!JSON.stringify((await call('list')).body).includes(gift.body.code));
const results=await Promise.all([call('redeem',{code:gift.body.code,product:'cape_space'},alice),call('redeem',{code:gift.body.code,product:'cape_scream'},bob)]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===400).length,1);
const winner=results[0].status===200?alice:bob;assert.equal((await d.rights(winner)).length,2);assert.equal((await d.rights(winner===alice?bob:alice)).length,1);
await clearRates();for(const uuid of [alice,bob])assert.equal((await call('redeem',{code:gift.body.code,product:'cape_spine'},uuid)).body.error,'invalid_or_used_code');
const next=(await call('create',{})).body;const owned=(await d.rights(winner)).find(p=>p!=='cape_job');await clearRates();assert.equal((await call('redeem',{code:next.code,product:owned},winner)).body.error,'already_owned');const different=owned==='cape_space'?'cape_crimson':'cape_space';assert.equal((await call('redeem',{code:next.code,product:different},winner)).status,200);
const bound=(await call('create',{code:'KOZO',recipient:alice})).body;await clearRates();assert.equal((await call('redeem',{code:bound.code,product:'cape_spine'},bob)).body.error,'invalid_or_used_code');assert.equal((await call('redeem',{code:bound.code,product:'cape_spine'},alice)).status,200);
const revoked=(await call('create',{})).body;assert.equal((await call('revoke',{id:revoked.id})).status,200);await clearRates();assert.equal((await call('redeem',{code:revoked.code,product:'cape_crimson'},bob)).body.error,'invalid_or_used_code');assert.equal((await call('revoke',{id:gift.body.id})).body.error,'already_used');
const expired=(await call('create',{})).body;for(const [k,v]of store.data)if(k.startsWith('gift:code:')&&v.id===expired.id){v.expiresAt=1;await store.put(k,v);}await clearRates();assert.equal((await call('redeem',{code:expired.code,product:'cape_spine'},bob)).body.error,'invalid_or_used_code');
await clearRates();assert.equal((await call('redeem',{code:'XXXX',product:'cape_job'},bob)).status,400);assert.equal((await call('redeem',{code:'XXXX',product:'cape_spine',uuid:owner},bob)).status,400);
await clearRates();for(let i=0;i<3;i++)assert.equal((await call('redeem',{code:'XXXX',product:'cape_spine'},bob)).status,400);assert.equal((await call('redeem',{code:'XXXX',product:'cape_spine'},bob)).status,429);
const live=new Directory({storage:store},{...env,XRN_SHOP_MODE:'live',STRIPE_SECRET_KEY:'sk_live_fixture',XRN_ALLOW_LIVE:'true',XRN_SHOP_RETURN_ORIGIN:'https://example.com',XRN_LIVE_PRODUCT_IDS:'cape_space,cape_scream,cape_spine,cape_crimson'});assert.deepEqual(await live.rights(winner),['cape_job']);
await d.alarm();assert.ok((await call('list')).body.gifts.length>=5);assert.ok((await d.rights(winner)).length>=2);
console.log('PASS gifts: server identity/owner, random hashed codes, any-one-cape choice, atomic concurrent redemption, replay rejection, no consumption when already owned, recipient binding, revoke/expiry, rate limits, durable rights, live/test isolation.');
