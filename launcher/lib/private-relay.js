'use strict';
// Developer workstation only. Public installations have no private-runtime.json
// and never start a local worker. No deployment or Cloudflare purchase occurs.
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),util=require('./util'),cfg=require('./config');
let starting=null;
async function health(url){try{const r=await fetch(url+'/health',{signal:AbortSignal.timeout(1000)}),j=await r.json();return r.ok&&j.service==='xrn-presence'&&j.version===2;}catch{return false;}}
async function run(){
 const file=path.join(util.appRoot(),'private-runtime.json');if(!fs.existsSync(file))return {private:false};
 const settings=JSON.parse(fs.readFileSync(file,'utf8')),config=cfg.load(),url=String(config.presenceUrl||'').replace(/\/+$/,'');
 if(!settings.enabled||!config.developerMode||url!=='http://127.0.0.1:8789')return {private:false};
 if(await health(url))return {private:true,running:true};
 const directory=path.resolve(settings.directory),script=path.resolve(settings.wrangler),node=path.resolve(settings.node);
 if(!fs.existsSync(path.join(directory,'wrangler.toml'))||!fs.existsSync(script)||!fs.existsSync(node))throw Error('Le relais privé doit être relancé depuis le dossier de développement.');
 const log=path.join(util.appRoot(),'logs/relay-local.log');fs.mkdirSync(path.dirname(log),{recursive:true});const fd=fs.openSync(log,'a');
 const child=spawn(node,[script,'dev','--local','--ip','127.0.0.1','--port','8789'],{cwd:directory,windowsHide:true,detached:true,env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore',fd,fd]});fs.closeSync(fd);child.unref();let spawnError=null;child.on('error',e=>{spawnError=e;});
 for(let i=0;i<40;i++){if(spawnError)throw Error('Le relais privé n’a pas démarré.');await new Promise(r=>setTimeout(r,500));if(await health(url))return {private:true,running:true};}
 throw Error('Le relais privé ne répond pas encore. Consultez son journal local.');
}
module.exports={start(){if(!starting)starting=run().finally(()=>{starting=null;});return starting;}};
