"use strict";
const fs=require('fs'),path=require('path'),crypto=require('crypto'),safe=require('./safe-path'),upstream=require('./user-cape-mod'),http=require('./http');
const sha=file=>crypto.createHash('sha512').update(fs.readFileSync(file)).digest('hex');
async function prepare(gameDir,supported,versionId,bus){
 if(!supported)return {status:'unsupported'};const profile=require('./mods').profilsMod().find(p=>p.version===versionId);if(!profile)return {status:'unsupported'};
 const c={version:profile.base,loader:profile.loader.id},root=path.resolve(gameDir),dir=safe.confine(root,path.join(root,'mods'));fs.mkdirSync(dir,{recursive:true});
 const cache=safe.confine(root,path.join(root,'.xrn-waveycapes/cache'));fs.mkdirSync(cache,{recursive:true});
 const pin=require('./wavey-builds.json').builds.find(b=>b.minecraft===c.version&&b.loader===c.loader),build=pin?upstream.validated(pin,c):await upstream.resolve(c,cache);if(!build)return {status:'unsupported',reason:'Capes flottantes : aucune version officielle compatible avec '+c.version+'.'};
 // Verify existing binaries before deciding to keep or suspend them. Never trust their filename alone.
 const active=fs.readdirSync(dir).filter(n=>/\.jar$/i.test(n)&&upstream.isWaveyCapes(safe.confine(dir,path.join(dir,n),false))),park=[];
 for(const name of active){const file=safe.confine(dir,path.join(dir,name),false),hash=sha(file);if(hash===build.sha512&&active.length===1)return {status:'existing',file:name};
  const metaFile=safe.confine(cache,path.join(cache,'official-'+hash+'.json'),false);let meta;try{meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));}catch{meta=await http.getJSON('https://api.modrinth.com/v2/version_file/'+hash+'?algorithm=sha512');fs.writeFileSync(metaFile,JSON.stringify(meta));}
  if(meta.project_id!=='kYuIpRLv'||!meta.files?.some(f=>f.hashes?.sha512===hash))throw Error('Mod de cape non vérifié : '+name+'. Votre fichier est conservé.');
  park.push(file);
 }
 const parked=[];try{for(const file of park){const backup=safe.confine(dir,file+'.xrn-incompatible.'+crypto.randomBytes(6).toString('hex'),false);fs.renameSync(file,backup);parked.push({file,backup});}return await upstream.ensure(versionId,root,bus,{automatic:true,pinned:build});}
 catch(e){for(const {file,backup}of parked.reverse())if(!fs.existsSync(file)&&fs.existsSync(backup))fs.renameSync(backup,file);throw e;}
}
module.exports={prepare};
