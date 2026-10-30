(function(){
 'use strict';const $=id=>document.getElementById(id),stage=$('shopStage'),canvas=$('shopPlayer'),angle=$('shopAngle');
 let viewer=null,current='',paused=false,images=[],frames=0,generation=0,frameIndex=-1,lastTime=0,lastSkin='',skinLoading=false,orbitRadius=50,frameMillis=80;
 const fallback=()=>{
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  x.fillStyle='#30283c';x.fillRect(0,0,64,64);x.fillStyle='#b8a2cc';x.fillRect(8,8,8,8);x.fillStyle='#20172e';x.fillRect(9,10,2,2);x.fillRect(13,10,2,2);x.fillStyle='#71608f';x.fillRect(20,20,8,12);x.fillRect(4,20,8,12);x.fillRect(20,52,8,12);return c;
 };
 function fill(){const fraction=Number(angle.value)/360;angle.style.setProperty('--fillpx',(9+Math.max(0,angle.clientWidth-18)*fraction)+'px');}
 function size(){if(!viewer)return;const r=stage.getBoundingClientRect();if(r.width>0&&r.height>0)viewer.setSize(Math.round(r.width),Math.round(r.height));fill();viewer.render();}
 function setAngle(value){if(!viewer)return;const limit=Math.PI-.001;value=Math.max(0,Math.min(360,value));const a=(value-180)/180*limit;viewer.camera.position.set(Math.sin(a)*orbitRadius,viewer.controls.target.y+3,Math.cos(a)*orbitRadius);viewer.controls.update();viewer.render();fill();}
 function start(){
  if(viewer)return true;
  try{
   const library=globalThis.skinview3d||(typeof require==='function'?require('./vendor/skinview3d-3.4.2.js'):null);
   viewer=new library.SkinViewer({canvas,width:400,height:390,skin:fallback(),renderPaused:true,zoom:.9,fov:46});viewer.controls.enableZoom=false;viewer.controls.enablePan=false;viewer.controls.enableDamping=false;viewer.controls.minAzimuthAngle=-Math.PI+.001;viewer.controls.maxAzimuthAngle=Math.PI-.001;viewer.controls.minPolarAngle=Math.PI*.3;viewer.controls.maxPolarAngle=Math.PI*.7;viewer.playerObject.rotation.y=Math.PI;viewer.globalLight.intensity=2;viewer.cameraLight.intensity=.7;viewer.playerObject.cape.rotation.x=.16;
   viewer.controls.addEventListener('change',()=>{const value=Math.max(0,Math.min(360,(viewer.controls.getAzimuthalAngle()/(Math.PI-.001)+1)*180));angle.value=Math.round(value);fill();viewer.render();});
   orbitRadius=Math.sqrt(Math.max(1,viewer.camera.position.lengthSq()-9));new ResizeObserver(size).observe(stage);size();setAngle(180);return true;
  }catch{$('shopSkinCaption').textContent='L’aperçu 3D nécessite l’accélération graphique.';return false;}
 }
 async function skin(){
  if(skinLoading||!viewer)return;skinLoading=true;
  try{const s=await window.XRN?.env?.cosmetics?.skin();if(s?.dataUrl&&s.dataUrl!==lastSkin){await viewer.loadSkin(s.dataUrl);lastSkin=s.dataUrl;viewer.render();}$('shopSkinCaption').textContent=s?.dataUrl?(s.name+' · Glissez pour tourner'):'Mannequin · Connectez votre compte pour afficher votre skin';}finally{skinLoading=false;}
 }
 function image(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
 async function select(p,stop){
  paused=stop;frameMillis=p.frameMillis||80;if(!start())return;skin();
  if(current===p.id)return;current=p.id;const g=++generation;frameIndex=-1;images=[];frames=p.animated?p.frames:1;
  const folder='assets/cosmetics/uv/'+p.id;
  try{
   const first=await image(p.animated?folder+'/00.png':folder+'.png');if(g!==generation)return;
   await viewer.loadCape(first);images[0]=first;viewer.render();
   if(p.animated){const loaded=await Promise.all(Array.from({length:frames-1},(_,i)=>image(folder+'/'+String(i+1).padStart(2,'0')+'.png')));if(g===generation)images=[first,...loaded];}
  }catch{if(g===generation)$('shopSkinCaption').textContent='Texture de cape indisponible.';}
 }
 function update(now){
  if(viewer&&images.length&&$('view-boutique').classList.contains('active')&&!document.hidden&&document.hasFocus()&&now-lastTime>=frameMillis){
   const i=paused?0:Math.floor(now/frameMillis)%images.length;if(i!==frameIndex){const c=viewer.capeCanvas;c.getContext('2d').drawImage(images[i],0,0,c.width,c.height);if(viewer.capeTexture)viewer.capeTexture.needsUpdate=true;viewer.render();frameIndex=i;}lastTime=now;
  }
  requestAnimationFrame(update);
 }
 angle.oninput=()=>{setAngle(Number(angle.value));fill();};window.XrnCapeViewer={select,stats(){return {ready:!!viewer,skin:!!lastSkin,frames:images.length,selected:current,paused,angle:Number(angle.value),frameIndex,azimuth:viewer?.controls.getAzimuthalAngle(),minAzimuth:viewer?.controls.minAzimuthAngle,maxAzimuth:viewer?.controls.maxAzimuthAngle};}};requestAnimationFrame(update);window.addEventListener('beforeunload',()=>viewer?.dispose());
})();
