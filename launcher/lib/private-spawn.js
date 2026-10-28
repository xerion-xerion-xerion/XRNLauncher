'use strict';
// Loaded only in the private developer worker through NODE_OPTIONS. Hiding the
// first Node process is not sufficient: Wrangler starts Node/workerd children.
if(process.platform==='win32'){
 const cp=require('child_process');
 for(const name of ['spawn','spawnSync','fork']){
  const original=cp[name];
  cp[name]=function(file,args,options){if(!Array.isArray(args)){options=args;args=[];}return original.call(this,file,args,{...options,windowsHide:true});};
 }
 const execFile=cp.execFile,execFileSync=cp.execFileSync,exec=cp.exec;
 cp.execFile=function(file,args,options,callback){if(!Array.isArray(args)){callback=options;options=args;args=[];}if(typeof options==='function'){callback=options;options={};}return execFile.call(this,file,args,{...options,windowsHide:true},callback);};
 cp.execFileSync=function(file,args,options){if(!Array.isArray(args)){options=args;args=[];}return execFileSync.call(this,file,args,{...options,windowsHide:true});};
 cp.exec=function(command,options,callback){if(typeof options==='function'){callback=options;options={};}return exec.call(this,command,{...options,windowsHide:true},callback);};
 require('module').syncBuiltinESMExports();
}
