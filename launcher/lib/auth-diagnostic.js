'use strict';
const fs=require('fs'),path=require('path'),util=require('./util');
function clean(value){return String(value||'').replace(/eyJ[A-Za-z0-9_.-]+/g,'[jeton masqué]').replace(/Bearer\s+\S+/gi,'Bearer [masqué]').replace(/[\w.+-]+@[\w.-]+/g,'[adresse masquée]').replace(/[\x00-\x1F]/g,' ').replace(/<[^>]*>/g,'').slice(0,400);}
function file(){return path.join(util.appRoot(),'auth-diagnostic.json');}
function record({stage,status,reason,clientId,requestId}){
 const diagnostic={at:new Date().toISOString(),stage,status:Number(status)||0,reason:clean(reason),clientId:String(clientId||''),requestId:clean(requestId)};
 util.ensureDir(util.appRoot());fs.writeFileSync(file(),JSON.stringify(diagnostic,null,2),{encoding:'utf8',mode:0o600});return diagnostic;
}
function current(){try{if(fs.statSync(file()).size>8192)return null;return JSON.parse(fs.readFileSync(file(),'utf8'));}catch{return null;}}
module.exports={record,current,clean};
