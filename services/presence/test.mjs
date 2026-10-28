import assert from 'node:assert/strict';
import {Directory,style} from './worker.mjs';
class Store {
 data=new Map();queue=Promise.resolve();time=null;
 async get(k){return structuredClone(this.data.get(k));}
 async put(k,v){this.data.set(k,structuredClone(v));}
 async delete(k){for(const key of Array.isArray(k)?k:[k])this.data.delete(key);}
 async list({prefix='',limit=10000}={}){return new Map([...this.data].filter(([k])=>k.startsWith(prefix)).slice(0,limit));}
 async getAlarm(){return this.time;}async setAlarm(t){this.time=t;}
 transaction(fn){const p=this.queue.then(()=>fn(this));this.queue=p.catch(()=>{});return p;}
}
const store=new Store(),directory=new Directory({storage:store},{}),realFetch=globalThis.fetch;
const users={Alice:'a'.repeat(32),Bob:'b'.repeat(32)};let joins=0;
globalThis.fetch=async u=>{const url=new URL(u);assert.equal(url.origin,'https://sessionserver.mojang.com');assert.equal(url.pathname,'/session/minecraft/hasJoined');assert.equal(url.searchParams.size,2);joins++;const name=url.searchParams.get('username');return users[name]?Response.json({id:users[name],name}):new Response(null,{status:204});};
async function call(route,data,session,ip='test'){
 const r=await directory.fetch(new Request('https://test'+route,{method:data===undefined?'GET':'POST',headers:{'CF-Connecting-IP':ip,...(session?{Authorization:'Bearer '+session}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})}));return {status:r.status,body:await r.json()};
}
try{
 assert.deepEqual(style({start:-1,end:0xFF000000,enabled:'yes'}),{animate:false,rainbow:false,enabled:false,badge:true,gradient:true,start:0xA78BFA,end:0xF4EEFF});
 const nonce=(await call('/v1/challenge')).body.id;
 const [first,replay]=await Promise.all([call('/v1/register',{challenge:nonce,username:'Alice',style:{enabled:true,start:0xAABBCC,end:0xFFFFFF}}),call('/v1/register',{challenge:nonce,username:'Alice'})]);
 assert.equal(first.status,200);assert.equal(replay.status,401);assert.equal(joins,1);
 const sessionA=first.body.session;assert.match(sessionA,/^[a-f0-9]{64}$/);
 const secondNonce=(await call('/v1/challenge')).body.id;
 const bob=await call('/v1/register',{challenge:secondNonce,username:'Bob',style:{badge:false}});assert.equal(bob.status,200);
 let players=(await call('/v1/players')).body.pseudos;assert.equal(players.length,2);assert.equal(players.find(p=>p.uuid===users.Alice).style.start,0xAABBCC);assert.equal(players.find(p=>p.uuid===users.Bob).style.badge,false);
 const animated=await call('/v1/style',{style:{enabled:true,animate:true,rainbow:false,start:0xAABBCC,end:0xFFFFFF}},sessionA);assert.equal(animated.status,200);const shared=(await call('/v1/players')).body.pseudos.find(p=>p.uuid===users.Alice);assert.equal(shared.style.animate,true);assert.equal(shared.style.rainbow,false);

 assert.ok(players.every(p=>!('sessionHash'in p)&&!('session'in p)&&p.verified));
 assert.equal((await call('/v1/style',{style:{start:0x123456}},'0'.repeat(64))).status,401);
 assert.equal((await call('/v1/style',{style:{enabled:true,start:0x123456},uuid:users.Bob},sessionA)).status,200);
 players=(await call('/v1/players')).body.pseudos;assert.equal(players.find(p=>p.uuid===users.Alice).style.start,0x123456);assert.equal(players.find(p=>p.uuid===users.Bob).style.badge,false);
 const fakeNonce=(await call('/v1/challenge')).body.id;assert.equal((await call('/v1/register',{challenge:fakeNonce,username:'Impostor'})).status,401);
 const stale=(await call('/v1/challenge')).body.id;await store.put('c:'+stale,{until:1});assert.equal((await call('/v1/register',{challenge:stale,username:'Alice'})).status,401);
 const expired=await store.get('p:'+users.Bob);expired.expiresAt=1;await store.put('p:'+users.Bob,expired);assert.equal((await call('/v1/players')).body.pseudos.length,1);
 for(let i=0;i<12;i++)assert.equal((await call('/v1/challenge',undefined,undefined,'rate')).status,200);
 assert.equal((await call('/v1/challenge',undefined,undefined,'rate')).status,429);
 assert.equal((await call('/v1/style',{style:{},extra:'x'.repeat(5000)},sessionA)).status,400);
 assert.equal((await call('/v1/missing')).status,404);
 console.log('PASS: two-player styles, identity proof, replay race, token scope, expiry, rate and body limits.');
}finally{globalThis.fetch=realFetch;}
