(function(){
 'use strict';const api=window.XRN?.env?.cosmetics,$=id=>document.getElementById(id);
 let data=null,products=[],selected='cape_xrn',paused=false,busy=false,generation=0;
 async function refresh(){
  const g=++generation;
  try{
   const result=api?await api.catalogue():{...await(await fetch('cosmetics.json')).json(),rights:['cape_xrn'],equipped:'',presence:{},connected:false};
   if(g!==generation)return;data=result;products=result.products;render();
  }catch{$('shopActionStatus').textContent='La collection est indisponible. Réessayez.';}
 }
 function render(){
  const box=$('shopProducts');box.replaceChildren();
  for(const p of products){const button=document.createElement('button');button.type='button';button.className='shop-product';button.setAttribute('aria-pressed',String(p.id===selected));
   const img=document.createElement('img');img.src=p.animated?p.preview.replace('.gif','-poster.png'):p.preview;img.alt='';const text=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small'),label=document.createElement('span');title.textContent=p.name;sub.textContent=p.animated?'Cape animée · Espace':'Cape XRN originale';text.append(title,sub);label.className='shop-product-label';label.textContent=p.free?'OFFERTE':'APERÇU';button.append(img,text,label);button.onclick=()=>{selected=p.id;paused=false;render();};box.append(button);
  }
  const p=products.find(p=>p.id===selected)||products[0];if(!p)return;
  $('shopPreviewLabel').textContent=p.name;$('shopAnimationLabel').textContent=p.animated?'Animation en boucle':'Cape originale';
  window.XrnCapeViewer?.select(p,paused);
  $('shopProductTitle').textContent=p.name;$('shopProductDescription').textContent=p.description;$('shopProductType').textContent=p.animated?'Cape animée':'Cape fixe';$('shopProductPrice').textContent=p.free?'Offerte':'Prix à définir';
  const owned=p.free||(data.rights||[]).includes(p.id),equipped=data.equipped===p.id;
  $('shopEquip').disabled=busy||!api||!owned;$('shopEquip').textContent=owned?(equipped?'Retirer la cape':'Équiper la cape '+p.name):'Bientôt disponible';
  $('shopPause').disabled=!p.animated;$('shopPause').textContent=paused?'Lire':'Pause';
  const state=data.presence||{};$('shopPresenceDot').classList.toggle('connected',!!state.registered);
  $('shopPresenceTitle').textContent=state.private?'Atelier privé':state.registered?'Apparence partagée':state.sharing===false?'Partage désactivé':'Partage entre joueurs';
  $('shopPresenceDescription').textContent=state.private?'Les essais de cette version restent sur ce PC. La diffusion aux autres joueurs attend votre autorisation.':state.registered?'Votre badge, votre couleur et votre cape équipée sont partagés avec les autres utilisateurs XRN.':state.sharing===false?'Le partage de votre apparence est désactivé dans les paramètres.':data.connected?(state.error||'Connexion au relais en cours. Le launcher doit rester ouvert pendant le jeu.'):'Connectez votre compte Microsoft dans XRN pour partager votre apparence.';
 }
 $('shopEquip').onclick=async()=>{
  if(!data||busy)return;busy=true;render();$('shopActionStatus').textContent='Enregistrement…';
  try{await api.equip(data.equipped===selected?'':selected);await refresh();$('shopActionStatus').textContent=data.equipped?'Cape équipée. Le changement apparaît aussi pendant la partie.':'Cape retirée.';}catch(e){$('shopActionStatus').textContent=e.message||'Modification impossible.';}finally{busy=false;render();}
 };
 $('shopRefresh').onclick=async()=>{if(!api||busy)return;$('shopRefresh').disabled=true;try{data=await api.refresh();products=data.products;render();}catch(e){$('shopActionStatus').textContent=e.message;}finally{$('shopRefresh').disabled=false;}};
 $('shopPause').onclick=()=>{paused=!paused;render();};
 window.XrnShop={refresh};
})();
