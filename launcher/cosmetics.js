(function(){
 'use strict';const api=window.XRN?.env?.cosmetics,$=id=>document.getElementById(id);
 let data=null,products=[],selected='cape_job',paused=false,busy=false,generation=0,pending=[],checking=false,lastCheck=0;
 async function refresh(){
  const g=++generation;
  try{
   const result=api?await api.catalogue():{...await(await fetch('cosmetics.json')).json(),rights:['cape_job'],equipped:'',presence:{},connected:false};
   if(g!==generation)return;data=result;products=result.products;render();if(data.gifts?.canGenerate)await giftHistory();
   if(data.paymentAvailable&&data.presence?.registered&&api?.orders){const recent=await api.orders();pending=(recent.orders||[]).filter(o=>['open','creating'].includes(o.state)).slice(0,8).map(o=>o.order);$('shopCheckPayment').hidden=!pending.length;}
  }catch{$('shopActionStatus').textContent='La collection est indisponible. Réessayez.';}
 }
 function render(){
  if(!products.some(p=>p.id===selected))selected=products[0]?.id||'';
  const box=$('shopProducts');box.replaceChildren();
  for(const p of products){const button=document.createElement('button');button.type='button';button.className='shop-product';button.setAttribute('aria-pressed',String(p.id===selected));
   const img=document.createElement('img');img.src=p.animated?p.preview.replace('.gif','-poster.png'):p.preview;img.alt='';const text=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small'),label=document.createElement('span');title.textContent=p.name;sub.textContent=p.animated?'Cape animée · Espace':(p.id==='cape_job'?'Cape fixe · Mème':'Cape fixe');text.append(title,sub);label.className='shop-product-label';label.textContent=p.free?'OFFERTE':'APERÇU';button.append(img,text,label);button.onclick=()=>{selected=p.id;paused=false;render();};box.append(button);
  }
  const p=products.find(p=>p.id===selected)||products[0];if(!p)return;
  $('shopPreviewLabel').textContent=p.name;$('shopAnimationLabel').textContent=p.animated?'Animation en boucle':'Cape fixe';
  window.XrnCapeViewer?.select(p,paused);
  $('shopProductTitle').textContent=p.name;$('shopProductDescription').textContent=p.description;$('shopProductType').textContent=p.animated?'Cape animée':'Cape fixe';$('shopProductPrice').textContent=p.free?'Offerte':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format((p.amount||299)/100);
  const owned=p.free||(data.rights||[]).includes(p.id),equipped=data.equipped===p.id;
  $('shopEquip').disabled=busy||!api||!owned;$('shopEquip').textContent=owned?(equipped?'Retirer la cape':'Équiper la cape '+p.name):'Bientôt disponible';
  $('shopEquip').hidden=!owned;
  $('shopBuy').hidden=p.free||owned;$('shopBuy').disabled=busy||!api?.checkout||!data.paymentAvailable||p.purchasable===false||!data.presence?.registered;
  $('shopBuy').textContent=(data.paymentAvailable?(data.paymentMode==='test'?'Tester l’achat · ':'Acheter · '):'Achat bientôt disponible · ')+new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format((p.amount||299)/100);
  $('shopMode').textContent=data.paymentAvailable?(data.paymentMode==='test'?'Stripe en mode test · Aucun débit réel':'Paiement sécurisé par Stripe'):'Service de paiement indisponible · Actualisez';
  $('shopPause').disabled=!p.animated;$('shopPause').textContent=paused?'Lire':'Pause';
  const giftSelect=$('shopGiftProduct'),previous=giftSelect.value;giftSelect.replaceChildren();
  for(const item of products.filter(item=>!item.free)){const option=document.createElement('option');option.value=item.id;option.textContent=item.name+((data.rights||[]).includes(item.id)?' · déjà possédée':'');option.disabled=(data.rights||[]).includes(item.id);giftSelect.append(option);}
  if([...giftSelect.options].some(o=>o.value===previous&&!o.disabled))giftSelect.value=previous;else if(giftSelect.selectedOptions[0]?.disabled)giftSelect.value=[...giftSelect.options].find(o=>!o.disabled)?.value||'';
  $('shopGiftRedeem').disabled=busy||!api?.gift||!data.gifts?.available||!data.presence?.registered||!giftSelect.value;
  $('shopGiftAdmin').hidden=!data.gifts?.canGenerate;
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
 $('shopBuy').onclick=async()=>{
  if(busy||!api?.checkout)return;busy=true;render();
  try{const order=await api.checkout(selected);pending=[...new Set([...pending,order.order])];$('shopCheckPayment').hidden=false;$('shopActionStatus').textContent=order.test?'Page Stripe de test ouverte dans votre navigateur. Aucun débit réel.':'Page Stripe ouverte : vérifiez le montant avant de confirmer.';}catch(e){$('shopActionStatus').textContent=e.message;}finally{busy=false;render();}
 };
 async function checkPayments(){
  if(checking||!pending.length||!api?.paymentStatus)return;checking=true;lastCheck=Date.now();
  try{for(const id of [...pending]){const result=await api.paymentStatus(id);if(['paid','revoked','expired'].includes(result.state)){pending=pending.filter(n=>n!==id);if(result.state==='paid'){$('shopActionStatus').textContent=(result.test?'Paiement de test confirmé. ':'Paiement confirmé. ')+'Cette cape est ajoutée à votre compte.';const current=await api.catalogue();data=current;products=current.products;render();}else $('shopActionStatus').textContent=result.state==='revoked'?'Achat remboursé ou contesté : cape retirée.':'Session expirée : aucun achat.';}}}catch(e){$('shopActionStatus').textContent=e.message;}finally{checking=false;$('shopCheckPayment').hidden=!pending.length;}
 }
 $('shopCheckPayment').onclick=checkPayments;
 setInterval(()=>{if(document.visibilityState==='visible'&&$('view-boutique').classList.contains('active')&&Date.now()-lastCheck>10000)checkPayments();},3000);
 setInterval(()=>{if(!busy&&!checking&&document.visibilityState==='visible'&&$('view-boutique').classList.contains('active'))refresh();},15000);
 const giftErrors={invalid_or_used_code:'Code invalide, expiré ou déjà utilisé.',already_owned:'Vous possédez déjà cette cape. Choisissez-en une autre : le code reste valable.',gift_rate_limit:'Trop de tentatives. Réessayez plus tard.',admin_required:'Ce compte ne peut pas générer de codes.',gifts_unavailable:'Les codes cadeaux sont momentanément indisponibles.'};
 const giftError=e=>Object.entries(giftErrors).find(([key])=>String(e.message).includes(key))?.[1]||e.message||'Opération impossible.';
 $('shopGiftForm').onsubmit=async e=>{e.preventDefault();if(busy||!api?.gift)return;const code=$('shopGiftCode').value.trim(),product=$('shopGiftProduct').value;if(!code||!product)return;busy=true;render();$('shopGiftStatus').textContent='Vérification du code…';try{const r=await api.gift('redeem',{code,product});selected=r.product;$('shopGiftCode').value='';await refresh();$('shopGiftStatus').textContent='Cape ajoutée à votre compte. Ce code est maintenant consommé.';}catch(error){$('shopGiftStatus').textContent=giftError(error);}finally{busy=false;render();}};
 async function giftHistory(){const r=await api.gift('list',{}),box=$('shopGiftHistory');box.replaceChildren();for(const item of r.gifts){const row=document.createElement('div');row.className='shop-gift-row';const text=document.createElement('span');text.textContent=new Date(item.createdAt).toLocaleDateString('fr-FR')+' · '+({ready:'Disponible',used:'Utilisé',revoked:'Annulé',expired:'Expiré'}[item.state]||item.state)+(item.product?' · '+(products.find(p=>p.id===item.product)?.name||item.product):'');row.append(text);if(item.state==='ready'){const button=document.createElement('button');button.type='button';button.className='btn sm';button.textContent='Annuler ce code';button.onclick=async()=>{button.disabled=true;try{await api.gift('revoke',{id:item.id});await giftHistory();}catch(error){$('shopGiftAdminStatus').textContent=giftError(error);button.disabled=false;}};row.append(button);}box.append(row);}}
 $('shopGiftCreateForm').onsubmit=async e=>{e.preventDefault();if(busy||!data?.gifts?.canGenerate)return;busy=true;$('shopGiftCreate').disabled=true;try{const r=await api.gift('create',{prefix:$('shopGiftPrefix').value.trim()||'XRN'});$('shopGiftGenerated').value=r.code;$('shopGiftResult').hidden=false;$('shopGiftAdminStatus').textContent='Code créé : une cape premium au choix, une seule utilisation.';await giftHistory();}catch(error){$('shopGiftAdminStatus').textContent=giftError(error);}finally{busy=false;$('shopGiftCreate').disabled=false;}};
 $('shopGiftCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('shopGiftGenerated').value);$('shopGiftAdminStatus').textContent='Code copié.';}catch{$('shopGiftGenerated').select();document.execCommand('copy');}};
 window.XrnShop={refresh};
})();
