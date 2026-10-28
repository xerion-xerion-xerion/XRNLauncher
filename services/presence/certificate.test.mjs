import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyCertificateProof,challengePayload} from './certificate.mjs';
const pair=()=>generateKeyPairSync('rsa',{modulusLength:2048});
const root=pair(),profileRoot=pair(),der=k=>k.export({format:'der',type:'spki'}),b64=b=>Buffer.from(b).toString('base64');
const keys={playerCertificateKeys:[{publicKey:b64(der(root.publicKey))}],profilePropertyKeys:[{publicKey:b64(der(profileRoot.publicKey))}]};
const nonce={audience:'https://presence.test'},challenge='a'.repeat(40),now=Date.now();
function player(uuid,name){
 const p=pair(),key=der(p.publicKey),expires=now+3600000,data=Buffer.alloc(24+key.length);Buffer.from(uuid,'hex').copy(data);data.writeBigInt64BE(BigInt(expires),16);key.copy(data,24);
 const value=b64(JSON.stringify({profileId:uuid,profileName:name,timestamp:now,textures:{}}));
 return {uuid,challenge,certificate:{publicKey:b64(key),expiresAt:new Date(expires).toISOString(),signature:b64(sign('RSA-SHA1',data,root.privateKey))},identity:{value,signature:b64(sign('RSA-SHA1',Buffer.from(value),profileRoot.privateKey))},proof:b64(sign('RSA-SHA256',challengePayload(nonce.audience,challenge,uuid),p.privateKey))};
}
const alice=player('a'.repeat(32),'Alice'),bob=player('b'.repeat(32),'Bob');
assert.equal((await verifyCertificateProof(alice,nonce,keys,now)).pseudo,'Alice');assert.equal((await verifyCertificateProof(bob,nonce,keys,now)).pseudo,'Bob');
await assert.rejects(verifyCertificateProof({...alice,uuid:bob.uuid},nonce,keys,now));
await assert.rejects(verifyCertificateProof({...alice,identity:bob.identity},nonce,keys,now));
await assert.rejects(verifyCertificateProof({...alice,challenge:'c'.repeat(40)},nonce,keys,now));
await assert.rejects(verifyCertificateProof(alice,{audience:'https://attacker.test'},keys,now));
await assert.rejects(verifyCertificateProof({...alice,proof:bob.proof},nonce,keys,now));
await assert.rejects(verifyCertificateProof(alice,nonce,keys,now+3600001));
await assert.rejects(verifyCertificateProof({...alice,certificate:{...alice.certificate,expiresAt:new Date(now+7200000).toISOString()}},nonce,keys,now));
await assert.rejects(verifyCertificateProof({...alice,certificate:{...alice.certificate,publicKey:'x'.repeat(9000)}},nonce,keys,now));
console.log('PASS certificate v2: two identities, signed name, UUID binding, key possession, audience, nonce, expiry and bounds.');
