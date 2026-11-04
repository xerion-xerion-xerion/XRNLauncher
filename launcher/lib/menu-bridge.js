'use strict';
const fs=require('fs'),path=require('path'),cfg=require('./config');
const uuid=v=>String(v||'').replace(/-/g,'').toLowerCase();
function start({account,emit}){let last='',busy=false;async function tick(){if(busy)return;busy=true;try{const a=account();if(!a)return;const f=path.join(cfg.load().gameDir,'.xrn-menu/request.json');if(!fs.existsSync(f)||fs.statSync(f).size>2048)return;const r=JSON.parse(fs.readFileSync(f,'utf8'));if(!/^[a-f0-9-]{36}$/.test(r.id||'')||r.id===last||uuid(r.uuid)!==uuid(a.id)||Math.abs(Date.now()-r.at)>10000)return;last=r.id;if(r.action==='store'||r.action==='open')emit('launcher:open',{view:'boutique'});else if(r.action==='account')emit('launcher:open',{view:'login'});}catch{}finally{busy=false;}}const timer=setInterval(tick,750);timer.unref?.();return {tick,stop(){clearInterval(timer);}};}
module.exports={start};
