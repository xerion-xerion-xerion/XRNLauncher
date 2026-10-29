// The existing Directory uses SQLite storage (2 MiB/value). One canonical cape is <=512 KiB.
// R2 is optional; old SQLite images remain readable if R2 is enabled later.
export function capeBucket(directory){const {store,env}=directory,key=name=>'prime:blob:'+name;return {
 async put(name,bytes,options){if(env.PRIME_CAPES)return env.PRIME_CAPES.put(name,bytes,options);if(bytes.length>524288)throw Error('cape_too_large');await store.put(key(name),{bytes:new Uint8Array(bytes),customMetadata:options.customMetadata});},
 async get(name){if(env.PRIME_CAPES){const result=await env.PRIME_CAPES.get(name);if(result)return result;}const record=await store.get(key(name));return record?{body:record.bytes,customMetadata:record.customMetadata}:null;},
 async delete(name){if(env.PRIME_CAPES)await env.PRIME_CAPES.delete(name);await store.delete(key(name));}
};}
