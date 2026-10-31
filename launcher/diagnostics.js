(()=>{'use strict';if(!window.XRN||typeof nw==='undefined')return;
let logWindow=null,opening=false,pending=false;const listeners=new Set(),lines=[];
const sanitize=s=>String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g,'').replace(/(Bearer\s+)[\w.+\/-]+/gi,'$1[masqué]').replace(/((?:access[_ -]?token|refresh[_ -]?token|authorization)\s*[=:]\s*["']?)[^\s"']+/gi,'$1[masqué]').replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[jeton masqué]');
const hub={status:'Aucun lancement',cancellable:false,attemptId:null,snapshot:()=>lines.slice(),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},clear(){lines.length=0;emit()},cancel(){if(!hub.cancellable)return;XRN.game.cancelLaunch();hub.cancellable=false;hub.status='Annulation en cours…';append(hub.status)}};
function emit(){if(pending)return;pending=true;setTimeout(()=>{pending=false;for(const fn of listeners)try{fn()}catch{}},80)}
function append(text){const stamp=new Date().toLocaleTimeString();for(const line of sanitize(text).split(/\r?\n/))if(line)lines.push('['+stamp+'] '+line.slice(0,4096));if(lines.length>2000)lines.splice(0,lines.length-2000);emit()}
function open(){if(logWindow){logWindow.show();logWindow.focus();return}if(opening)return;opening=true;
 try{nw.Window.open('diagnostic.html',{title:'XRN — Journal Minecraft',width:1000,height:660,min_width:650,min_height:380,position:'center',icon:'assets/icon.png'},w=>{opening=false;if(!w){hub.status='Impossible d’ouvrir le journal';emit();return}logWindow=w;const connect=()=>w.window.attachXrnLogHub?.(hub);w.on('loaded',connect);connect();w.on('closed',()=>{logWindow=null;listeners.clear()})})}catch(e){opening=false;append('Ouverture du journal : '+e.message)}}
function belongs(d){return !d.attemptId||!hub.attemptId||d.attemptId===hub.attemptId}
XRN.on('game:preparing',d=>{hub.attemptId=d.attemptId;hub.cancellable=true;emit()});
for(const event of ['mods:stage','mods:notice','dl:stage'])XRN.on(event,d=>{if(hub.cancellable)append(d.text||'')});
XRN.on('game:spawn',d=>{if(!belongs(d))return;hub.status='Minecraft démarre · initialisation en cours';append('Java démarré · PID '+d.pid+' · attente de l’écran du jeu')});
XRN.on('game:ready',d=>{if(!belongs(d))return;hub.status='Minecraft prêt · écran du jeu chargé';hub.cancellable=false;append(hub.status)});
XRN.on('game:log',d=>{if(belongs(d))append(d.line)});
XRN.on('game:exit',d=>{if(!belongs(d))return;hub.cancellable=false;hub.status=d.cancelled?'Lancement annulé':d.code===0?'Minecraft fermé':'Minecraft arrêté · code '+d.code;append(hub.status+(d.error?' · '+d.error:''));if(!d.cancelled&&d.code!==0)open()});
const original=XRN.game.launch;XRN.game.launch=async opts=>{lines.length=0;hub.attemptId=null;hub.cancellable=true;hub.status='Préparation du lancement';append('Nouvelle session · '+opts.version);open();try{return await original.call(XRN.game,opts)}catch(e){hub.cancellable=false;hub.status=e.cancelled?'Lancement annulé':'Échec du lancement';append(hub.status+' · '+e.message);throw e}};
window.XrnDiagnostics={open,status:()=>hub.status};window.addEventListener('beforeunload',()=>logWindow?.close(true));
})();
