"use strict";
const {randomUUID}=require('crypto');let current=null;
function check(token){if(token?.cancelled){const e=new Error('Lancement annulé.');e.code='launch_cancelled';e.cancelled=true;throw e;}}
function begin(){if(current){const e=new Error('Un lancement est déjà en cours.');e.code='launch_pending';throw e;}return current={id:randomUUID(),cancelled:false,child:null,ready:false};}
function cancel(){if(!current||current.ready)return false;current.cancelled=true;if(current.child&&!current.child.killed)current.child.kill();return true;}
function attach(token,child){if(!token)return;token.child=child;if(token.cancelled)child.kill();}
function ready(token){if(!token||current!==token||token.cancelled)return false;token.ready=true;return true;}
function end(token){if(current===token)current=null;}
module.exports={begin,cancel,end,check,attach,ready};
