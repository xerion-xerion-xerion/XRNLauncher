'use strict';
// The remote Microsoft page has no Node privileges (no node-remote manifest).
// Only a top-level navigation to the registered redirect can complete OAuth.
function open(nw, flow, sisu) {
  let win, settled=false, accepting=false, timer, outcome={done:false};
  function finish(error,tokens) {
    if(settled)return;settled=true;clearTimeout(timer);
    outcome=error?{error}:{done:true,tokens};
    if(win)win.close(true);
  }
  nw.Window.open(flow.url,{new_instance:false,mixed_context:false,width:520,height:720,position:'center',frame:true,focus:true,title:'Connexion Microsoft — XRN'},w=>{
    win=w;
    if(settled){w.close(true);return;}
    function receive(url,policy){
      let parsed;try{parsed=new URL(url);}catch{policy?.ignore();return;}
      if(parsed.protocol!=='https:'){policy?.ignore();return;}
      if(parsed.origin!==new URL(sisu.REDIRECT).origin || parsed.pathname!==new URL(sisu.REDIRECT).pathname)return;
      policy?.ignore();
      if(accepting || settled)return;accepting=true;
      try{
        const code=sisu.redirect(flow.ctx,url);
        sisu.exchange(flow.ctx,code).then(tokens=>finish(null,tokens),error=>finish(error));
      }catch(error){finish(error);}
    }
    w.on('navigation',(frame,url,policy)=>{if(!frame)receive(url,policy);});
    // Chromium location.replace / server redirects do not consistently emit
    // navigation in all NW releases. Read only the top-level URL after load.
    // No form fields, cookies or page contents are read.
    w.on('loaded',()=>{try{receive(w.window.location.href);}catch(error){finish(error);}});
    w.on('new-win-policy',(frame,url,policy)=>policy.ignore());
    w.on('closed',()=>{win=null;if(!settled)finish(new Error('Connexion Microsoft fermée.'));});
  });
  timer=setTimeout(()=>finish(new Error('La connexion Microsoft a expiré.')),flow.expiresIn*1000);
  return {poll(){if(outcome.error)throw outcome.error;return outcome;},cancel(){finish(new Error('Connexion annulée.'));}};
}
module.exports={open};
