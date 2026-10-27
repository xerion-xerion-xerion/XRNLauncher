 'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),util=require('./util'),network=require('./server-status');
const DEFAULT_SERVERS=[
 {name:'PvPHub',host:'pvphub.me',port:25565,website:'https://store.pvphub.me/'},
 {name:'Vanilla Practice',host:'vanillapractice.com',port:25565,website:'https://www.vanillapractice.com/'},
 {name:'Nimlot',host:'nimlot.xyz',port:25565,website:'https://discord.gg/nRGHPepKPd'},
 {name:'PvP Club',host:'mcpvp.club',port:25565,website:'https://mcpvp.club/'},
 {name:'Minemen Club',host:'minemen.club',port:25565,website:'https://minemen.club/'},
 {name:'Central PvP',host:'centralpvp.net',port:25565,website:'https://modrinth.com/server/centralpvp/'}
];
function serverFile(){return path.join(util.appRoot(),'servers.json');}
function iconFile(host,port){return path.join(util.appRoot(),'cache/server-icons',crypto.createHash('sha256').update(host+':'+port).digest('hex')+'.png');}
function cachedIcon(host,port){try{return 'data:image/png;base64,'+fs.readFileSync(iconFile(host,port)).toString('base64');}catch{return '';}}
function saveServers(list){util.writeJSON(serverFile(),{schema:3,list:(list||[]).map(({icon,...s})=>s)});}
function loadServers(){
 const data=util.readJSON(serverFile(),null);
 if(data&&data.schema>=2&&Array.isArray(data.list)){
  if(data.schema===2){for(const preset of DEFAULT_SERVERS.slice(0,3))if(!data.list.some(s=>s.host.toLowerCase()===preset.host))data.list.push({...preset});saveServers(data.list);}
  return data.list.map(s=>({...s,icon:cachedIcon(s.host,s.port)}));
 }
 const list=Array.isArray(data)?data:[];
 for(const preset of DEFAULT_SERVERS)if(!list.some(s=>s.host.toLowerCase()===preset.host&&Number(s.port)===preset.port))list.push({...preset});
 saveServers(list);return list.map(s=>({...s,icon:cachedIcon(s.host,s.port)}));
}
function addServer(inputHost,inputPort,name){const {host,port}=network.endpoint(inputHost,inputPort),list=loadServers();if(!list.some(s=>s.host.toLowerCase()===host.toLowerCase()&&s.port===port)){list.push({host,port,name:String(name||host).slice(0,64)});saveServers(list);}return list;}
function removeServer(host,port){const list=loadServers().filter(s=>!(s.host===host&&s.port===Number(port)));saveServers(list);return list;}
const cache=new Map();
async function status(host,port){
 const key=host+':'+port,old=cache.get(key);if(old&&Date.now()-old.at<15000)return old.promise;
 const promise=network.status(host,port).then(data=>{if(data.favicon){const target=iconFile(host,port);util.ensureDir(path.dirname(target));try{fs.writeFileSync(target,Buffer.from(data.favicon.slice(22),'base64'));}catch{}}return data;});
 cache.set(key,{at:Date.now(),promise});if(cache.size>64)cache.delete(cache.keys().next().value);return promise;
}
module.exports={status,loadServers,saveServers,addServer,removeServer,serverFile,DEFAULT_SERVERS};
