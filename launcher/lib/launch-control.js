'use strict';
let current=null;
function check(token){if(token?.cancelled){const e=new Error('Lancement annulé.');e.code='launch_cancelled';e.cancelled=true;throw e;}}
function begin(){if(current){const e=new Error('Un lancement est déjà en cours.');e.code='launch_pending';throw e;}current={cancelled:false};return current;}
function cancel(){if(!current)return false;current.cancelled=true;return true;}
function end(token){if(current===token)current=null;}
module.exports={begin,cancel,end,check};
