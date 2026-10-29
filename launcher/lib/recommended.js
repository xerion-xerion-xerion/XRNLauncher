'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),create=require('./managed-mod'),http=require('./http');
const specs=[['eXts2L7r','Text Placeholder API',['placeholder-api'],/^placeholder-api-/i],['P7dR8mSH','Fabric API',['fabric-api'],/^fabric-api-/i],['9s6osm5g','Cloth Config API',['cloth-config'],/^cloth-config-/i],['AANobbMI','Sodium',['sodium'],/^sodium-/i],['YL57xq9U','Iris Shaders',['iris'],/^iris-/i],['uXXizFIs','FerriteCore',['ferritecore'],/^ferritecore-/i],['mOgUt4GM','Mod Menu',['modmenu'],/^modmenu-/i]];
const allowed=specs.map(s=>s[0]),running=new Map();
async function ensure(version,gameDir,bus){
 const root=path.resolve(gameDir),profile=require('./mods').profilsMod().find(p=>p.version===version);if(!profile||profile.loader.id!=='fabric')return [];
 if(running.has(root))return running.get(root);
 const operation=(async()=>{
 const c={version:profile.base,loader:'fabric'},instances=new Map(specs.map(([project,name,ids,prefix])=>{const spec={project,name,ids,prefix,allowed};return [project,{spec,api:create(spec)}];})),plans=new Map(),results=[],ready=new Map(),cache=path.join(root,'.xrn-recommended-metadata');fs.mkdirSync(cache,{recursive:true});
 async function metadata(project,exact){
  if(!allowed.includes(project)||exact&&!/^[A-Za-z0-9]{8}$/.test(exact))throw Error('Dépendance non prévue ; utilisez Découvrir les mods.');
  let record={files:{}};try{record=JSON.parse(fs.readFileSync(path.join(root,'.xrn-recommended-'+project,'state.json'),'utf8'));}catch{}
  const modDir=path.join(root,'mods'),instance=instances.get(project),manual=fs.existsSync(modDir)?fs.readdirSync(modDir).filter(n=>/\.jar$/i.test(n)&&!record.files?.[n]&&instance.api.isEssential(path.join(modDir,n))):[];
  if(manual.length>1)throw Error('Plusieurs fichiers manuels pour '+instance.spec.name);
  if(manual.length){const sha=crypto.createHash('sha512').update(fs.readFileSync(path.join(modDir,manual[0]))).digest('hex'),stored=path.join(cache,'manual-'+sha+'.json');let v;try{v=JSON.parse(fs.readFileSync(stored,'utf8'));}catch{v=await http.getJSON('https://api.modrinth.com/v2/version_file/'+sha+'?algorithm=sha512');fs.writeFileSync(stored,JSON.stringify(v));}if(v.project_id!==project||!v.game_versions?.includes(c.version)||!v.loaders?.includes(c.loader)||exact&&v.id!==exact)throw Error('Le mod manuel '+instance.spec.name+' ne correspond pas à cette installation ou à sa dépendance.');return v;}
  const file=path.join(cache,project+'-'+c.version+'-'+(exact||'latest')+'.json');let cached;
  try{if(fs.statSync(file).size<262144)cached=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
  if(cached&&Date.now()-cached.savedAt<86400000)return cached.value;
  try{const q=new URLSearchParams({game_versions:JSON.stringify([c.version]),loaders:'["fabric"]',include_changelog:'false'});const response=await http.getJSON('https://api.modrinth.com/v2/'+(exact?'version/'+exact:'project/'+project+'/version?'+q));const v=exact?response:response.filter(v=>v.version_type==='release').sort((a,b)=>Date.parse(b.date_published)-Date.parse(a.date_published))[0];if(!v||v.project_id!==project||!v.game_versions?.includes(c.version)||!v.loaders?.includes('fabric'))throw Error('Aucune version officielle compatible pour '+instances.get(project).spec.name+' / '+c.version);const value={id:v.id,project_id:v.project_id,name:v.name,files:v.files,dependencies:v.dependencies||[],game_versions:v.game_versions,loaders:v.loaders};fs.writeFileSync(file,JSON.stringify({savedAt:Date.now(),value}));return value;}catch(e){if(cached)return cached.value;throw e;}
 }
 async function visit(project,exact,stack=new Set()){
  if(stack.has(project))throw Error('Cycle de dépendances');if(plans.has(project)){const existing=plans.get(project);if(exact&&existing.v.id!==exact)throw Error('Versions incompatibles de '+existing.instance.spec.name);return existing;}
  const v=await metadata(project,exact),instance=instances.get(project),deps=[];stack.add(project);
  for(const d of v.dependencies){if(d.dependency_type==='required'){if(!d.project_id)throw Error('Dépendance externe manquante');const dep=await visit(d.project_id,d.version_id,stack);deps.push({project:d.project_id,exact:!!d.version_id,hash:(dep.v.files.find(f=>f.primary)||dep.v.files[0]).hashes.sha512});}}
  stack.delete(project);const f=v.files.find(f=>f.primary)||v.files[0];instance.spec.pinned={minecraft:c.version,loader:c.loader,version:v.id,name:v.name,filename:f.filename,url:f.url,size:f.size,sha512:f.hashes.sha512};const item={instance,v,deps};plans.set(project,item);return item;
 }
 // Resolve Iris before Sodium so its exact dependency is preserved.
 let protectSodium=false;for(const project of ['YL57xq9U',...allowed.filter(id=>id!=='YL57xq9U')]){if(project==='AANobbMI'&&protectSodium)continue;try{await visit(project);}catch(e){if(project==='YL57xq9U'&&fs.existsSync(path.join(root,'mods'))&&fs.readdirSync(path.join(root,'mods')).some(n=>/\.jar$/i.test(n)&&instances.get(project).api.isEssential(path.join(root,'mods',n)))){protectSodium=true;plans.delete('AANobbMI');}results.push({name:instances.get(project).spec.name,status:'unsupported',reason:e.message});}}
 for(const {instance}of plans.values())await instance.api.prefetch(version,root,bus);
 const rollback=require('./mod-transaction').snapshot(root,plans);
 try{
 for(const [project,{instance,deps}]of plans){try{
  for(const d of deps){if(!ready.get(d.project))throw Error('Dépendance désactivée ou indisponible');if(d.exact){const dep=plans.get(d.project);const found=fs.readdirSync(path.join(root,'mods')).filter(n=>/\.jar$/i.test(n)).some(n=>{const file=path.join(root,'mods',n);return dep.instance.api.isEssential(file)&&crypto.createHash('sha512').update(fs.readFileSync(file)).digest('hex')===d.hash;});if(!found)throw Error('La version manuelle d’une dépendance ne correspond pas. Votre fichier est conservé.');}}
  const r=await instance.api.ensure(version,root,bus);ready.set(project,['installed','existing'].includes(r.status));results.push({name:instance.spec.name,...r});
 }catch(e){if(!/Dépendance|version manuelle/.test(e.message))throw e;instance.spec.disabled=true;await instance.api.ensure(version,root,bus);ready.set(project,false);results.push({name:instance.spec.name,status:'disabled',reason:e.message});}}
 }catch(e){rollback();throw e;}
 const essential=await require('./essential').ensure(version,root,bus);results.push({name:'Essential',...essential});for(const r of results)if(r.reason)bus?.emit('mods:notice',{text:r.name+' : '+r.reason});return results;
 })();running.set(root,operation);try{return await operation;}finally{running.delete(root);}
}
module.exports={ensure,specs};
