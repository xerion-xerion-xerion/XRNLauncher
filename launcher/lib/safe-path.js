'use strict';
const fs=require('fs'),path=require('path');
function inside(root,target){const r=path.relative(root,target);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));}
function name(value){
  if(typeof value!=='string'||!value||value==='.'||value==='..'||/[<>:"/\\|?*\x00-\x1f]/.test(value)||/[. ]$/.test(value)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value))throw new Error('Nom de fichier invalide');
  return value;
}
// Resolve existing ancestors too: a junction inside the game folder must not
// turn a confined create/delete/read into an operation elsewhere on the PC.
function confine(root,target,allowRoot=true){
  root=path.resolve(root);target=path.resolve(target);
  if(!inside(root,target)||(!allowRoot&&target.toLowerCase()===root.toLowerCase()))throw new Error('Accès refusé : en dehors du dossier autorisé');
  let existing=target;
  while(!fs.existsSync(existing)){const parent=path.dirname(existing);if(parent===existing)break;existing=parent;}
  if(fs.existsSync(root)&&fs.existsSync(existing)){
    const actualRoot=fs.realpathSync(root),actual=fs.realpathSync(existing);
    if(!inside(actualRoot,actual))throw new Error('Accès refusé : lien vers un autre dossier');
  }
  return target;
}
module.exports={inside,name,confine};
