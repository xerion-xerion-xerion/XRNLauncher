(function(){
 'use strict';
 const api=window.XRN,box=document.getElementById('shotGrid'),more=document.getElementById('shotMore'),status=document.getElementById('shotStatus');
 const viewer=document.getElementById('shotViewer'),image=document.getElementById('shotLarge'),caption=document.getElementById('shotCaption');
 let generation=0,next=0,busy=false,items=[],selected=0;
 async function show(index){
  if(!items.length)return;selected=(index+items.length)%items.length;const item=items[selected];
  caption.textContent=item.name;image.alt=item.name;image.removeAttribute('src');
  if(!viewer.open)viewer.showModal();
  try{const src=await api.screenshots.image(item.name);if(items[selected]===item&&viewer.open)image.src=src;}catch{caption.textContent='Capture indisponible. Actualisez la galerie.';}
 }
 async function refresh(append=false){
  if(!api){status.textContent='Les captures F2 seront disponibles dans l’application Windows.';return;}
  if(busy&&append)return;
  const version=append?generation:++generation;
  if(!append){next=0;items=[];box.replaceChildren();}
  busy=true;more.disabled=true;status.textContent='Lecture des captures…';
  try{
   const result=await api.screenshots.list(next||0,24);if(version!==generation)return;
   for(const item of result.items){
    const index=items.length;items.push(item);
    const button=document.createElement('button');button.className='shot-card';button.type='button';button.setAttribute('aria-label','Voir '+item.name);
    const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.alt='';
    const label=document.createElement('span');label.textContent=item.name;
    const date=document.createElement('small');date.textContent=new Date(item.mtime).toLocaleString('fr-FR');
    button.append(img,label,date);button.onclick=()=>show(index);box.append(button);
    api.screenshots.image(item.name).then(src=>{if(version===generation)img.src=src;}).catch(()=>{img.alt='Image indisponible';});
   }
   next=result.next;more.hidden=next===null;status.textContent=result.total?result.total+' capture'+(result.total>1?'s':'')+' · F2 dans Minecraft pour en ajouter':'Aucune capture. Appuyez sur F2 pendant une partie.';
  }catch(e){if(version===generation)status.textContent='Lecture impossible : '+e.message;}
  finally{if(version===generation){busy=false;more.disabled=false;}}
 }
 document.getElementById('shotRefresh').onclick=()=>refresh();more.onclick=()=>refresh(true);
 document.getElementById('shotFolder').onclick=async()=>{if(api)api.env.openExplorer(await api.screenshots.folder());};
 document.getElementById('shotClose').onclick=()=>viewer.close();
 document.getElementById('shotPrev').onclick=()=>show(selected-1);document.getElementById('shotNext').onclick=()=>show(selected+1);
 viewer.addEventListener('close',()=>image.removeAttribute('src'));
 viewer.addEventListener('click',e=>{if(e.target===viewer)viewer.close();});
 viewer.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(selected-1);}if(e.key==='ArrowRight'){e.preventDefault();show(selected+1);}});
 window.XrnGallery={refresh};
})();
