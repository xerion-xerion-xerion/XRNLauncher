'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const cfg=require('./config'),safe=require('./safe-path');
function folder(){const base=cfg.load().gameDir;return safe.confine(base,path.join(base,'screenshots'));}
async function list(offset=0,limit=24){
 const root=folder();let entries;
 try{entries=await fs.promises.readdir(root,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return {items:[],total:0,next:null};throw e;}
 const names=entries.filter(e=>e.isFile()&&/\.(png|jpe?g)$/i.test(e.name)).map(e=>e.name);
 const items=[];
 for(let i=0;i<names.length;i+=16){await Promise.all(names.slice(i,i+16).map(async name=>{try{const p=safe.confine(root,path.join(root,name),false);const stat=await fs.promises.stat(p);if(stat.size<=64*1024*1024)items.push({name,size:stat.size,mtime:stat.mtimeMs});}catch{}}));}
 items.sort((a,b)=>b.mtime-a.mtime||a.name.localeCompare(b.name));
 offset=Math.max(0,Math.floor(Number(offset)||0));limit=Math.max(1,Math.min(48,Math.floor(Number(limit)||24)));
 return {items:items.slice(offset,offset+limit),total:items.length,next:offset+limit<items.length?offset+limit:null};
}
async function image(name){
 safe.name(name);if(!/\.(png|jpe?g)$/i.test(name))throw new Error('Format de capture non autorisé');
 const p=safe.confine(folder(),path.join(folder(),name),false),file=await fs.promises.open(p,'r');
 try{
  const stat=await file.stat();if(!stat.isFile()||stat.size>64*1024*1024)throw new Error('Capture trop volumineuse');
  const head=Buffer.alloc(8);await file.read(head,0,8,0);
  if(!head.equals(Buffer.from([137,80,78,71,13,10,26,10]))&&!(head[0]===255&&head[1]===216&&head[2]===255))throw new Error('Image invalide');
  return pathToFileURL(p).href;
 }finally{await file.close();}
}
module.exports={list,image,folder};
