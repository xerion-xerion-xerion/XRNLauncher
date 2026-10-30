'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const http=require('./http'),config=require('./config'),mods=require('./mods'),safe=require('./safe-path');
const MR='https://api.modrinth.com/v2',plans=new Map();let installing=false;
const loaderTypes={forge:1,fabric:4,quilt:5,neoforge:6};
function context(id){const p=mods.profilsMod().find(p=>p.version===id);if(!p||!loaderTypes[p.loader.id])throw Error('Sélectionne une installation Fabric, Forge, Quilt ou NeoForge.');return {installation:id,version:p.base,loader:p.loader.id,gameDir:path.resolve(config.load().gameDir)};}
function contexts(){return mods.profilsMod().map(p=>({id:p.version,version:p.base,loader:p.loader.id}));}
function id(value){if(typeof value!=='string'||!/^[A-Za-z0-9_.+-]{1,100}$/.test(value))throw Error('Identifiant de projet invalide');return encodeURIComponent(value);}
function iconUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='cdn.modrinth.com'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
function compatible(v,c){return Array.isArray(v.game_versions)&&v.game_versions.includes(c.version)&&v.loaders.includes(c.loader)&&v.environment!=='server_only'&&v.environment!=='dedicated_server_only';}
function pick(versions,c){return versions.filter(v=>compatible(v,c)).sort((a,b)=>(a.version_type==='release'?0:1)-(b.version_type==='release'?0:1)||Date.parse(b.date_published)-Date.parse(a.date_published))[0];}
async function mrVersion(project,c){const q=new URLSearchParams({loaders:JSON.stringify([c.loader]),game_versions:JSON.stringify([c.version]),include_changelog:'false'});const v=pick(await http.getJSON(MR+'/project/'+id(project)+'/version?'+q),c);if(!v)throw Error('Aucun fichier compatible pour '+project+' ('+c.version+', '+c.loader+').');return v;}
async function search(provider,query,installation,options={}){
 const c=installation?context(installation):null;query=String(query||'').trim().slice(0,100);
 if(provider==='modrinth'){
  const offset=Math.max(0,Math.min(10000,Math.floor(Number(options.offset)||0))),sort=['downloads','relevance','updated'].includes(options.sort)?options.sort:'downloads';
  const q=new URLSearchParams({query,index:sort,offset:String(offset),limit:'20',facets:JSON.stringify([['project_type:mod'],...(c?[["versions:"+c.version],["categories:"+c.loader]]:[]),['client_side:required','client_side:optional']])});
  const data=await http.getJSON(MR+'/search?'+q);
  // Slugs are display metadata, not trusted identifiers. A malformed hit must
  // never break the whole catalogue or become a filesystem/download parameter.
  const items=(data.hits||[]).filter(p=>typeof p.project_id==='string'&&/^[A-Za-z0-9]{8}$/.test(p.project_id)).map(p=>({id:p.project_id,title:String(p.title||'Mod'),description:String(p.description||''),author:String(p.author||''),url:'https://modrinth.com/mod/'+id(p.project_id),icon:iconUrl(p.icon_url),downloads:Number(p.downloads)||0,updated:p.date_modified||'',loaders:(p.categories||[]).filter(v=>Object.hasOwn(loaderTypes,v)),categories:(p.display_categories||p.categories||[]).filter(v=>typeof v==='string').slice(0,4)}));
  return {context:c,browseOnly:!c,items,offset,total:Number(data.total_hits)||items.length};
 }
 throw Error('Catalogue inconnu');
}
function fileUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!['cdn.modrinth.com'].includes(u.hostname))throw Error('Adresse de téléchargement refusée');return u.href;}
function mrFile(v){const f=v.files.find(f=>f.primary)||v.files[0];if(!f||!/^([a-f0-9]{128})$/i.test(f.hashes?.sha512)||!f.size||f.size>256*1024*1024)throw Error('Fichier ou empreinte Modrinth invalide');safe.name(f.filename);if(!/\.jar$/i.test(f.filename))throw Error('Le fichier du mod doit être un .jar');return {filename:f.filename,url:fileUrl(f.url),size:f.size,algorithm:'sha512',hash:f.hashes.sha512};}

async function prepare(provider,project,installation){
 const c=context(installation),selected=new Map(),visiting=new Set(),blocked=new Set();
 async function visit(project,exact){
  if(selected.size>=40)throw Error('Trop de dépendances pour une seule installation');
  let v,title,file,deps,versionId,projectId;
  if(provider==='modrinth'){
   v=exact?await http.getJSON(MR+'/version/'+id(exact)):await mrVersion(project,c);
   if(!compatible(v,c))throw Error('Une dépendance ne correspond pas à cette version de Minecraft.');
   projectId=v.project_id;versionId=v.id;title=v.name;file=mrFile(v);deps=v.dependencies||[];
  }else throw Error('Catalogue inconnu');
  if(selected.has(projectId)){if(exact&&selected.get(projectId).version!==versionId)throw Error('Deux dépendances exigent des versions différentes du même mod.');return;}
  if(visiting.has(projectId))return;visiting.add(projectId);
  selected.set(projectId,{project:projectId,version:versionId,title,...file});
  for(const d of deps){if(d.dependency_type==='incompatible'&&d.project_id)blocked.add(d.project_id);if(d.dependency_type==='required'){if(!d.project_id&&!d.version_id)throw Error('Dépendance externe à installer manuellement');await visit(d.project_id,d.version_id);}}
  visiting.delete(projectId);
 }
 await visit(project);
 if([...blocked].some(p=>selected.has(p)))throw Error('Ces dépendances contiennent des mods incompatibles.');
 const files=[...selected.values()];if(new Set(files.map(f=>f.filename.toLowerCase())).size!==files.length)throw Error('Deux mods utilisent le même nom de fichier');
 if(files.reduce((n,f)=>n+f.size,0)>512*1024*1024)throw Error('Téléchargement trop volumineux');
 for(const [key,p]of plans)if(p.expires<Date.now())plans.delete(key);
 const token=crypto.randomBytes(20).toString('hex');plans.set(token,{provider,c,files,expires:Date.now()+300000});
 return {token,context:c,files:files.map(({title,filename,size})=>({title,filename,size})),bytes:files.reduce((n,f)=>n+f.size,0)};
}
async function hash(file,algorithm){const h=crypto.createHash(algorithm);for await(const part of fs.createReadStream(file))h.update(part);return h.digest('hex');}
async function install(token){
 const plan=plans.get(token);plans.delete(token);
 if(!plan||plan.expires<Date.now())throw Error('La sélection a expiré. Relance la recherche.');if(installing)throw Error('Une installation est déjà en cours');
 const current=context(plan.c.installation);if(JSON.stringify(current)!==JSON.stringify(plan.c))throw Error('L’installation sélectionnée a changé.');
 installing=true;const dir=mods.modsDir(),staged=[],added=[],backups=[];fs.mkdirSync(dir,{recursive:true});
 const recordPath=safe.confine(current.gameDir,path.join(current.gameDir,'xrn-catalogue.json'),false);
 let record={};try{record=JSON.parse(fs.readFileSync(recordPath,'utf8'));}catch{}
 try{
  for(const f of plan.files){
   const target=safe.confine(dir,path.join(dir,f.filename),false);
   if(fs.existsSync(target)){if(await hash(target,f.algorithm)!==f.hash)throw Error('Un autre fichier porte déjà ce nom : '+f.filename);staged.push({...f,target,reuse:true});continue;}
   const temp=safe.confine(dir,path.join(dir,'.xrn-'+token+'-'+staged.length+'.part'),false);staged.push({...f,target,temp});
   await http.download(f.url,temp,{verify:true,retries:1,...(f.algorithm==='sha1'?{sha1:f.hash}:{})});
   if(fs.statSync(temp).size!==f.size||await hash(temp,f.algorithm)!==f.hash)throw Error('Le fichier reçu ne correspond pas à l’empreinte attendue : '+f.filename);
  }
  for(const f of staged){
   const key=plan.provider+':'+f.project,old=record[key];
   if(old&&old.filename!==f.filename){safe.name(old.filename);const previous=safe.confine(dir,path.join(dir,old.filename),false);if(fs.existsSync(previous)){if(!['sha1','sha512'].includes(old.algorithm)||await hash(previous,old.algorithm)!==old.hash)throw Error('La précédente version a été modifiée : '+old.filename);const backup=safe.confine(dir,path.join(dir,'.xrn-'+token+'-'+backups.length+'.backup'),false);fs.renameSync(previous,backup);backups.push({previous,backup});}}
   if(!f.reuse){fs.renameSync(f.temp,f.target);added.push(f.target);}
   record[key]={filename:f.filename,version:f.version,algorithm:f.algorithm,hash:f.hash,mc:current.version,loader:current.loader};
  }
  const tempRecord=recordPath+'.'+token+'.tmp';fs.writeFileSync(tempRecord,JSON.stringify(record,null,2),{flag:'wx'});fs.renameSync(tempRecord,recordPath);
  // Old versions are retained as disabled backup files, never loaded by Minecraft.
  return {installed:staged.map(f=>f.filename),mods:mods.list()};
 }catch(e){for(const p of added.reverse())if(fs.existsSync(p))fs.unlinkSync(p);for(const b of backups.reverse())if(fs.existsSync(b.backup))fs.renameSync(b.backup,b.previous);throw e;}
 finally{for(const f of staged)if(f.temp&&fs.existsSync(f.temp))fs.unlinkSync(f.temp);installing=false;}
}
module.exports={contexts,search,prepare,install,pick,compatible,fileUrl};
