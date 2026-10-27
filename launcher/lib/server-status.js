'use strict';
const net=require('net'),dns=require('dns').promises;
function varint(v){const bytes=[];v>>>=0;do{let b=v&127;v>>>=7;if(v)b|=128;bytes.push(b);}while(v);return Buffer.from(bytes);}
function packet(id,body){const bytes=Buffer.concat([varint(id),body]);return Buffer.concat([varint(bytes.length),bytes]);}
function string(value){const b=Buffer.from(value,'utf8');return Buffer.concat([varint(b.length),b]);}
function read(buf,offset=0){let value=0;for(let i=0;i<5;i++){if(offset+i>=buf.length)return null;const b=buf[offset+i];value|=(b&127)<<(7*i);if(!(b&128))return {value:value>>>0,size:i+1};}throw Error('VarInt invalide');}
function text(component,depth=0){if(depth>12)return '';if(typeof component==='string')return component;if(Array.isArray(component))return component.slice(0,64).map(c=>text(c,depth+1)).join('');if(component&&typeof component==='object')return String(component.text||'')+text(component.extra,depth+1);return '';}
function favicon(value){
 if(typeof value!=='string'||value.length>100000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value))return '';
 try{const b=Buffer.from(value.slice(22),'base64');if(b.length<24||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b.readUInt32BE(16)>256||b.readUInt32BE(20)>256)return '';return value;}catch{return '';}
}
function endpoint(host,port){
 host=String(host||'').trim().replace(/^\[|\]$/g,'');port=Number(port||25565);
 if((!net.isIP(host)&&!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(host))||!Number.isInteger(port)||port<1||port>65535)throw Error('Adresse du serveur invalide');
 return {host,port};
}
async function resolve(host,port){
 if(port!==25565||net.isIP(host)||host==='localhost')return {host,port};
 let timer;try{const entries=await Promise.race([dns.resolveSrv('_minecraft._tcp.'+host),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DNS timeout')),1200);})]);entries.sort((a,b)=>a.priority-b.priority);if(entries[0])return {host:entries[0].name,port:entries[0].port};}catch{}finally{clearTimeout(timer);}return {host,port};
}
async function status(inputHost,inputPort){
 const {host,port}=endpoint(inputHost,inputPort),target=await resolve(host,port);
 return new Promise((resolve,reject)=>{
  const sock=new net.Socket(),started=Date.now();let done=false,buffer=Buffer.alloc(0),data,pingAt,pongTimeout;
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(pongTimeout);sock.destroy();error?reject(error):resolve(result);};
  const result=latency=>({host,port,online:true,version:String(data.version?.name||''),protocol:data.version?.protocol,players:Number(data.players?.online)||0,maxPlayers:Number(data.players?.max)||0,description:text(data.description).replace(/§[0-9a-fk-orx]/gi,'').slice(0,1024),favicon:favicon(data.favicon),latency:Math.max(1,latency),handshake:Date.now()-started});
  sock.setTimeout(5000);sock.on('timeout',()=>finish(Error('Délai de réponse dépassé')));sock.on('error',e=>finish(Error(e.code||'Connexion impossible')));sock.on('close',()=>{if(!done)finish(data?null:Error('Serveur déconnecté'),data?result(Date.now()-started):null);});
  sock.on('data',chunk=>{
   if(done)return;if(buffer.length+chunk.length>1024*1024){finish(Error('Réponse trop volumineuse'));return;}buffer=Buffer.concat([buffer,chunk]);
   try{while(buffer.length){
    const length=read(buffer);if(!length)return;if(length.value>1024*1024)throw Error('Paquet trop volumineux');if(buffer.length<length.size+length.value)return;
    const frame=buffer.subarray(length.size,length.size+length.value);buffer=buffer.subarray(length.size+length.value);const id=read(frame);if(!id)throw Error('Paquet invalide');
    if(!data){if(id.value!==0)throw Error('Réponse inattendue');const size=read(frame,id.size);if(!size||id.size+size.size+size.value>frame.length)throw Error('Statut invalide');data=JSON.parse(frame.toString('utf8',id.size+size.size,id.size+size.size+size.value));pingAt=Date.now();sock.write(packet(1,Buffer.alloc(8)));pongTimeout=setTimeout(()=>finish(null,result(Date.now()-started)),1200);}
    else if(id.value===1){finish(null,result(Date.now()-pingAt));return;}
   }}catch(e){finish(Error('Statut Minecraft invalide : '+e.message));}
  });
  sock.connect(target.port,target.host,()=>{sock.write(Buffer.concat([packet(0,Buffer.concat([varint(767),string(host),Buffer.from([port>>8,port&255]),varint(1)])),packet(0,Buffer.alloc(0))]));});
 });
}
module.exports={status,endpoint,favicon,varint,packet,string,read};
