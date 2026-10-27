'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
let cached=null;
const clone=value=>JSON.parse(JSON.stringify(value));
function crypt(mode,value){
 if(process.platform!=='win32')throw Error('La protection de session nécessite Windows.');
 const exe=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
 try{return Buffer.from(execFileSync(exe,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'windows-vault.ps1'),'-Mode',mode],{input:value.toString('base64'),encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024,windowsHide:true,stdio:['pipe','pipe','pipe']}).trim(),'base64');}
 catch{throw Error('Impossible de protéger ou de lire la session Windows. Aucun jeton ne sera enregistré en clair.');}
}
function read(file){
 if(!fs.existsSync(file))return {accounts:[]};
 const stat=fs.statSync(file),key=file+':'+stat.mtimeMs+':'+stat.ctimeMs+':'+stat.size;
 if(cached?.key===key)return clone(cached.db);
 if(stat.size>4*1024*1024)throw Error('Fichier de session trop volumineux.');
 const value=JSON.parse(fs.readFileSync(file,'utf8'));
 const db=value.format==='xrn-dpapi-v1'?JSON.parse(crypt('Unprotect',Buffer.from(value.data,'base64')).toString('utf8')):value;
 if(!db||!Array.isArray(db.accounts))throw Error('Fichier de session invalide.');
 cached={key,db};
 return clone(db);
}
function write(file,db){
 if(!db||!Array.isArray(db.accounts))throw Error('Session invalide.');
 const data=crypt('Protect',Buffer.from(JSON.stringify(db),'utf8')).toString('base64');
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.'+process.pid+'.tmp';
 try{fs.writeFileSync(temp,JSON.stringify({format:'xrn-dpapi-v1',data}),{encoding:'utf8',mode:0o600});fs.renameSync(temp,file);cached=null;}
 catch(error){try{fs.unlinkSync(temp)}catch{}throw error;}
}
module.exports={read,write};
