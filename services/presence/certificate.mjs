import roots from './mojang-public-keys.json' with {type:'json'};
const encoder=new TextEncoder();
function bytes(value,max=4096){
 if(typeof value!=='string'||value.length>max*2||! /^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('encoding');
 const data=Uint8Array.from(atob(value),c=>c.charCodeAt(0));if(data.length>max)throw Error('size');return data;
}
async function verify(key,signature,data,algorithm='SHA-1'){
 const imported=await crypto.subtle.importKey('spki',key,{name:'RSASSA-PKCS1-v1_5',hash:algorithm},false,['verify']);
 return crypto.subtle.verify('RSASSA-PKCS1-v1_5',imported,signature,data);
}
async function official(kind,signature,payload,keys){
 for(const root of keys[kind])if(await verify(bytes(root.publicKey),signature,payload))return true;
 return false;
}
export function challengePayload(audience,challenge,uuid){return encoder.encode(`xrn-presence-v2\n${audience}\n${challenge}\n${uuid}`);}
// Minecraft's UUID-bound v2 certificate: UUID[16] + expiry[8 BE] + SPKI DER.
// Public roots are pinned from Mojang's HTTPS /publickeys endpoint. A caller
// can never supply roots, a private key, or a Microsoft/Minecraft access token.
export async function verifyCertificateProof(body,nonce,keys=roots,now=Date.now()){
 if(!/^[a-f0-9]{32}$/.test(body.uuid||''))throw Error('uuid');
 const c=body.certificate||{},expires=Date.parse(c.expiresAt);
 if(!Number.isFinite(expires)||expires<=now||expires>now+7*86400000)throw Error('expired');
 const key=bytes(c.publicKey,1024),sig=bytes(c.signature,1024),payload=new Uint8Array(24+key.length);
 for(let i=0;i<16;i++)payload[i]=parseInt(body.uuid.slice(i*2,i*2+2),16);
 new DataView(payload.buffer).setBigInt64(16,BigInt(expires),false);payload.set(key,24);
 if(!await official('playerCertificateKeys',sig,payload,keys))throw Error('certificate');
 if(!await verify(key,bytes(body.proof,1024),challengePayload(nonce.audience,body.challenge,body.uuid),'SHA-256'))throw Error('possession');
 const identity=body.identity||{},value=bytes(identity.value,3072);
 if(!await official('profilePropertyKeys',bytes(identity.signature,1024),encoder.encode(identity.value),keys))throw Error('identity');
 const profile=JSON.parse(new TextDecoder().decode(value));
 if(profile.profileId?.toLowerCase()!==body.uuid||!/^\w{1,16}$/.test(profile.profileName||''))throw Error('identity_uuid');
 return {uuid:body.uuid,pseudo:profile.profileName,certificateExpiresAt:expires};
}
