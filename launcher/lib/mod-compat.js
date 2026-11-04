'use strict';

const fs=require('fs'),path=require('path');

function classes(file){const fd=fs.openSync(file,'r');try{const n=fs.fstatSync(fd).size;if(n<22||n>536870912)return '';const tail=Buffer.alloc(Math.min(n,65557));fs.readSync(fd,tail,0,tail.length,n-tail.length);let end=-1;for(let i=tail.length-22;i>=0;i--)if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){end=i;break;}if(end<0)return '';const size=tail.readUInt32LE(end+12),at=tail.readUInt32LE(end+16);if(size>16777216||at+size>n)return '';const data=Buffer.alloc(size);fs.readSync(fd,data,0,size,at);return data.toString('latin1');}finally{fs.closeSync(fd);}}

function check(gameDir){const root=path.join(gameDir,'mods');if(!fs.existsSync(root))return;for(const name of fs.readdirSync(root)){if(!/\.jar$/i.test(name))continue;const file=path.join(root,name);if(fs.lstatSync(file).isSymbolicLink())continue;const directory=classes(file);if(directory.includes('com/leclowndu93150/essentialpatcher/httpsync/EssentialSpsSyncListener.class'))throw Error('Essential Patcher : cette variante a provoqué un crash avec Essential (SPSStartEvent absent). Désactivez Essential Patcher dans Gestion des mods ou installez une version compatible avant de relancer. Votre fichier est conservé.');}}

module.exports={check};
