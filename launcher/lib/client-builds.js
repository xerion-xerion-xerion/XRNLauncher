'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),safe=require('./safe-path');
const root=path.resolve(__dirname,'../mods-integres');
function manifest(){try{const j=JSON.parse(fs.readFileSync(path.join(root,'compatibility.json'),'utf8'));return j.schema===1&&Array.isArray(j.builds)?j.builds:[];}catch{return [];}}
function filePath(file){safe.name(file.name);return safe.confine(root,path.join(root,file.name),false);}
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function selected(versionId,gameDir){
 if(typeof versionId!=='string'||!versionId)return {supported:false,reason:'Sélectionnez une installation Fabric.'};
 safe.name(versionId);let id=versionId,isFabric=/fabric/i.test(id);const seen=new Set();
 for(let depth=0;depth<8;depth++){
  if(seen.has(id))throw Error('Héritage de version circulaire');seen.add(id);safe.name(id);
  const target=safe.confine(gameDir,path.join(gameDir,'versions',id,id+'.json'),false);let j={};try{j=JSON.parse(fs.readFileSync(target,'utf8'));}catch{}
  if(/fabric/i.test(String(j.mainClass||'')))isFabric=true;
  if(!j.inheritsFrom)break;id=j.inheritsFrom;
 }
 const build=manifest().find(b=>b.minecraft===id&&b.loader==='fabric');
 if(!isFabric)return {supported:false,minecraft:id,reason:'XRN Client nécessite une installation Fabric.'};
 if(!build)return {supported:false,minecraft:id,reason:'Le module XRN n’est pas encore fourni pour Minecraft '+id+'.'};
 return {supported:true,minecraft:id,...build};
}
function install(versionId,gameDir,enabled=true){
 const dir=safe.confine(gameDir,path.join(gameDir,'mods'));fs.mkdirSync(dir,{recursive:true});
 const build=selected(versionId,gameDir),all=manifest().flatMap(b=>b.files||[]),known=new Set(all.map(f=>f.name));
 const poses=[],echecs=[],active=fs.readdirSync(dir).filter(n=>/\.jar$/i.test(n));
 const disabled=!enabled||fs.readdirSync(dir).some(n=>/^xrn-hud-.*\.jar\.disabled$/i.test(n));
 const desired=build.supported?build.files.filter(f=>!disabled||!/^xrn-hud-/i.test(f.name)).filter(f=>!disabled||!fs.existsSync(path.join(dir,f.name+'.disabled'))):[],wanted=new Set(desired.map(f=>f.name));
 const managed=name=>known.has(name)||/^xrn-hud-.*\.jar$/i.test(name);
 // Preflight every source and conflict before mutating the mod folder.
 for(const file of desired){
  if(!/^[a-f0-9]{64}$/i.test(file.sha256)||sha(filePath(file))!==file.sha256)throw Error('Module intégré corrompu : '+file.name);
  if(fs.existsSync(path.join(dir,file.name+'.disabled')))echecs.push({nom:file.name,raison:'Cette dépendance est désactivée. Réactivez-la dans Mods pour utiliser XRN Client.'});
 }
 if(build.supported&&!disabled){
  for(const name of active){
   if(/^fabric-api-.*\.jar$/i.test(name)&&!known.has(name)){echecs.push({nom:name,raison:'Une autre version de Fabric API est présente. Désactivez-la dans Mods avant de lancer cette installation.'});}
  }
 }
 if(echecs.length)return {poses,echecs,compatibility:build};
 for(const name of active){
  if(!managed(name)||wanted.has(name))continue;
  const target=safe.confine(dir,path.join(dir,name),false);
  let parked=target+'.xrn-incompatible';if(fs.existsSync(parked))parked+='.'+Date.now();
  fs.renameSync(target,parked);poses.push('suspendu : '+name);
 }
 for(const file of desired){
  const target=safe.confine(dir,path.join(dir,file.name),false);
  if(fs.existsSync(target)&&sha(target)===file.sha256)continue;
  if(fs.existsSync(target))fs.renameSync(target,target+'.xrn-backup.'+Date.now());
  const temp=target+'.tmp';fs.copyFileSync(filePath(file),temp);fs.renameSync(temp,target);poses.push(file.name);
 }
 return {poses,echecs,compatibility:build};
}
module.exports={manifest,selected,install};
