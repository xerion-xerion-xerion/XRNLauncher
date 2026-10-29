'use strict';
// Official Essential downloads, per Minecraft/loader. No modified or rehosted JAR.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const http=require('./http'),safe=require('./safe-path'),config=require('./config');
const PROJECT='k2ZPuTBm',MR='https://api.modrinth.com/v2',locks=new Set();
async function hash(file){const h=crypto.createHash('sha512');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
function validated(b,c){
 if(!b||b.minecraft!==c.version||b.loader!==c.loader||!/^[A-Za-z0-9]{8}$/.test(b.version)||!Number.isSafeInteger(b.size)||b.size<1||b.size>128*1024*1024||!/^[a-f0-9]{128}$/i.test(b.sha512))throw Error('Fichier Essential invalide');safe.name(b.filename);if(!/\.jar$/i.test(b.filename))throw Error('Fichier Essential invalide');
 const u=new URL(b.url);if(u.protocol!=='https:'||u.hostname!=='cdn.modrinth.com'||u.username||u.password||u.search||u.hash||u.pathname!==`/data/${PROJECT}/versions/${b.version}/${encodeURIComponent(b.filename)}`)throw Error('Source Essential refusee');return b;
}
// Read only small manifest entries from the central directory; never extract a JAR.
function isEssential(file){
 let fd;try{
  fd=fs.openSync(file,'r');const size=fs.fstatSync(fd).size;if(size<22||size>512*1024*1024)return false;
  const read=(offset,len)=>{if(offset<0||len<0||offset+len>size)throw Error('ZIP range');const b=Buffer.alloc(len);if(fs.readSync(fd,b,0,len,offset)!==len)throw Error('ZIP read');return b;};
  const tail=read(Math.max(0,size-65557),Math.min(size,65557));let end=-1;
  for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}if(end<0)return false;
  const bytes=tail.readUInt32LE(end+12),offset=tail.readUInt32LE(end+16);if(bytes>16*1024*1024)return false;const directory=read(offset,bytes);
  for(let p=0;p+46<=directory.length;){if(directory.readUInt32LE(p)!==0x02014b50)break;const nameLen=directory.readUInt16LE(p+28),extra=directory.readUInt16LE(p+30),comment=directory.readUInt16LE(p+32),name=directory.toString('utf8',p+46,p+46+nameLen);if(p+46+nameLen+extra+comment>directory.length)return false;
   if(['fabric.mod.json','META-INF/mods.toml','META-INF/neoforge.mods.toml'].includes(name)){
    const compressed=directory.readUInt32LE(p+20),plain=directory.readUInt32LE(p+24),local=directory.readUInt32LE(p+42),method=directory.readUInt16LE(p+10);if(compressed>512*1024||plain>512*1024||![0,8].includes(method))return false;
    const h=read(local,30);if(h.readUInt32LE(0)!==0x04034b50)return false;const data=read(local+30+h.readUInt16LE(26)+h.readUInt16LE(28),compressed),decoded=method===8?zlib.inflateRawSync(data,{maxOutputLength:512*1024}):data;if(decoded.length!==plain)return false;const text=decoded.toString('utf8');if(name==='fabric.mod.json'){if(['essential','essential-container','essential-loader'].includes(JSON.parse(text).id))return true;}else if(/\bmodId\s*=\s*["']essential["']/.test(text))return true;
   }p+=46+nameLen+extra+comment;
  }return false;
 }catch{return false;}finally{if(fd!==undefined)fs.closeSync(fd);}
}
function context(versionId){const p=require('./mods').profilsMod().find(p=>p.version===versionId);return p&&['fabric','forge','neoforge'].includes(p.loader.id)?{version:p.base,loader:p.loader.id}:null;}
async function resolve(c,cache){
 const pins=require('../essential-builds.json');let b=pins.builds.find(b=>b.minecraft===c.version&&b.loader===c.loader);if(b)return validated(b,c);
 const meta=safe.confine(cache,path.join(cache,'build-'+c.loader+'-'+c.version+'.json'),false);
 if(fs.existsSync(meta)&&fs.statSync(meta).size<65536)try{return validated(JSON.parse(fs.readFileSync(meta,'utf8')),c);}catch{}
 const q=new URLSearchParams({game_versions:JSON.stringify([c.version]),loaders:JSON.stringify([c.loader])});const versions=await http.getJSON(MR+'/project/'+PROJECT+'/version?'+q);
 const v=versions.filter(v=>v.project_id===PROJECT&&v.version_type==='release'&&v.game_versions?.includes(c.version)&&v.loaders?.includes(c.loader)).sort((a,b)=>Date.parse(b.date_published)-Date.parse(a.date_published))[0];if(!v)return null;if(v.dependencies?.some(d=>d.dependency_type==='required'))throw Error('Cette version Essential exige une dependance supplementaire ; installez-la via Decouvrir les mods.');
 const f=v.files.find(f=>f.primary)||v.files[0];b=validated({minecraft:c.version,loader:c.loader,version:v.id,name:v.name,filename:f.filename,url:f.url,size:f.size,sha512:f.hashes?.sha512},c);const tmp=meta+'.tmp';fs.writeFileSync(tmp,JSON.stringify(b));fs.renameSync(tmp,meta);return b;
}
async function ensure(versionId,gameDir,bus){
 const root=path.resolve(gameDir);if(locks.has(root))throw Error('Essential est deja en cours de preparation.');locks.add(root);
 try{
  const dir=safe.confine(root,path.join(root,'mods')),data=safe.confine(root,path.join(root,'.xrn-essential')),cache=safe.confine(root,path.join(data,'cache'));fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(cache,{recursive:true});
  const recordFile=safe.confine(root,path.join(data,'state.json'),false);let record={schema:1,files:{}};
  if(fs.existsSync(recordFile)){if(fs.statSync(recordFile).size>131072)throw Error('Etat Essential invalide');record=JSON.parse(fs.readFileSync(recordFile,'utf8'));if(record.schema!==1||!record.files||Array.isArray(record.files))throw Error('Etat Essential invalide');}
  for(const [name,item]of Object.entries(record.files)){safe.name(name);if(!/\.jar$/i.test(name)||!/^[a-f0-9]{128}$/i.test(item.sha512))throw Error('Etat Essential invalide');}
  const entries=fs.readdirSync(dir).filter(n=>/\.jar(?:\.disabled)?$/i.test(n));const essential=entries.filter(n=>record.files[n.replace(/\.disabled$/i,'')]||/^essential(?:[_ .-]|\.jar)/i.test(n)||isEssential(safe.confine(dir,path.join(dir,n),false)));
  const active=essential.filter(n=>/\.jar$/i.test(n));
  async function park(names){for(const name of names){const item=record.files[name];if(!item)continue;const target=safe.confine(dir,path.join(dir,name),false);if(!fs.existsSync(target))continue;if(await hash(target)!==item.sha512)throw Error('Le fichier Essential gere a ete modifie : '+name);const parked=safe.confine(dir,path.join(dir,name+'.xrn-incompatible.'+crypto.randomBytes(4).toString('hex')),false);fs.renameSync(target,parked);}}
  const c=context(versionId);if(!c||config.load().essentialEnabled===false||essential.some(n=>/\.disabled$/i.test(n))){await park(active);return {status:'disabled',reason:!c?'Installation sans chargeur compatible.':'Votre choix de desactivation Essential est conserve.'};}
  const manual=active.filter(n=>!record.files[n]);if(manual.length>1)throw Error('Plusieurs fichiers Essential sont presents. Gardez-en un seul dans Mods.');if(manual.length){await park(active.filter(n=>record.files[n]));return {status:'existing',file:manual[0],reason:'Essential deja installe manuellement : votre fichier est conserve.'};}
  const b=await resolve(c,cache);if(!b){await park(active);return {status:'unsupported',reason:'Essential ne propose pas de version compatible pour '+c.version+' / '+c.loader+'.'};}
  const target=safe.confine(dir,path.join(dir,b.filename),false);
  // Preflight existing managed JARs before downloading or moving any file.
  for(const name of active)if(await hash(safe.confine(dir,path.join(dir,name),false))!==record.files[name].sha512)throw Error('Le fichier Essential gere a ete modifie : '+name);
  if(fs.existsSync(target)&&await hash(target)===b.sha512){await park(active.filter(n=>n!==b.filename));return {status:'installed',file:b.filename,reused:true};}
  if(fs.existsSync(target))throw Error('Un autre fichier porte deja ce nom : '+b.filename);
  const cached=safe.confine(cache,path.join(cache,b.sha512.slice(0,16)+'-'+b.filename),false);
  if(!fs.existsSync(cached)||fs.statSync(cached).size!==b.size||await hash(cached)!==b.sha512){
   bus?.emit('mods:stage',{text:'Telechargement de '+b.name+' pour '+c.version+'…'});const temp=cached+'.part';try{await http.download(b.url,temp,{verify:true,retries:1});if(fs.statSync(temp).size!==b.size||await hash(temp)!==b.sha512||!isEssential(temp))throw Error('Empreinte ou contenu Essential incorrect');fs.renameSync(temp,cached);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
  const temp=safe.confine(dir,path.join(dir,'.xrn-essential-'+crypto.randomBytes(8).toString('hex')+'.part'),false);fs.copyFileSync(cached,temp);let parked=[];
  try{
   // All network and verification work finished before the current version is suspended.
   for(const name of active){const original=safe.confine(dir,path.join(dir,name),false),backup=safe.confine(dir,path.join(dir,name+'.xrn-incompatible.'+crypto.randomBytes(4).toString('hex')),false);fs.renameSync(original,backup);parked.push({original,backup});}
   fs.renameSync(temp,target);record.files[b.filename]={sha512:b.sha512,minecraft:c.version,loader:c.loader,version:b.version};const tmp=recordFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(record,null,2));fs.renameSync(tmp,recordFile);
  }catch(e){if(fs.existsSync(target)&&await hash(target)===b.sha512)fs.unlinkSync(target);for(const p of parked.reverse())if(fs.existsSync(p.backup))fs.renameSync(p.backup,p.original);throw e;}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
  return {status:'installed',file:b.filename,reused:false};
 }finally{locks.delete(root);}
}
module.exports={ensure,isEssential,validated,resolve};

