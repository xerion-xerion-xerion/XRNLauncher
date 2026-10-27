'use strict';
// Xbox proof-of-possession + OAuth PKCE. No credentials are read by XRN.
const crypto = require('crypto');
const http = require('./http');
const CLIENT_ID = '00000000402b5328';
const REDIRECT = 'https://login.live.com/oauth20_desktop.srf';
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';
const PROVIDER = 'xbox-sisu-pkce';
function failure(stage, response) {
  const code = response.json?.XErr || response.json?.error || '';
  const error = new Error('Connexion refusée à l’étape ' + stage + ' (HTTP ' + response.status + (code ? ', ' + code : '') + ').');
  error.code = 'sisu'; error.stage = stage; error.status = response.status;
  // Response bodies may contain OAuth material; never propagate them to logs/UI.
  return error;
}
function create(transport = http) {
  function key() {
    const pair = crypto.generateKeyPairSync('ec', {namedCurve:'prime256v1'});
    const jwk = pair.publicKey.export({format:'jwk'});
    return {privateKey:pair.privateKey, proof:{kty:'EC',x:jwk.x,y:jwk.y,crv:'P-256',alg:'ES256',use:'sig'}, id:crypto.randomUUID(), date:Date.now()};
  }
  async function signed(ctx, url, payload, stage) {
    const body = JSON.stringify(payload), version = Buffer.alloc(4), time = Buffer.alloc(8), zero = Buffer.from([0]);
    version.writeUInt32BE(1);
    time.writeBigUInt64BE((BigInt(Math.floor(ctx.date/1000))+11644473600n)*10000000n);
    const data = Buffer.concat([version,zero,time,zero,Buffer.from('POST'),zero,Buffer.from(new URL(url).pathname),zero,zero,Buffer.from(body),zero]);
    const sig = crypto.sign('sha256',data,{key:ctx.privateKey,dsaEncoding:'ieee-p1363'});
    const headers = {Accept:'application/json','Content-Type':'application/json; charset=utf-8',Signature:Buffer.concat([version,time,sig]).toString('base64')};
    if(url!=='https://sisu.xboxlive.com/authorize')headers['x-xbl-contract-version']='1';
    const r = await transport.postJSON(url,body,headers);
    const date = Date.parse(r.headers?.date || ''); if(Number.isFinite(date))ctx.date=date;
    if(r.status!==200 || !r.json)throw failure(stage,r);
    return r;
  }
  async function device() {
    const ctx=key();
    const r=await signed(ctx,'https://device.auth.xboxlive.com/device/authenticate',{
      Properties:{AuthMethod:'ProofOfPossession',Id:'{'+ctx.id.toUpperCase()+'}',DeviceType:'Win32',Version:'10.16.0',ProofKey:ctx.proof},
      RelyingParty:'http://auth.xboxlive.com',TokenType:'JWT'
    },'Xbox appareil');
    if(!r.json.Token)throw failure('Xbox appareil',r);
    ctx.deviceToken=r.json.Token; return ctx;
  }
  async function begin() {
    const ctx=await device();
    ctx.verifier=crypto.randomBytes(48).toString('base64url');ctx.state=crypto.randomBytes(32).toString('base64url');
    ctx.expiresAt=Date.now()+10*60*1000;ctx.used=false;
    const r=await signed(ctx,'https://sisu.xboxlive.com/authenticate',{
      AppId:CLIENT_ID,DeviceToken:ctx.deviceToken,Offers:[SCOPE],
      Query:{code_challenge:crypto.createHash('sha256').update(ctx.verifier).digest('base64url'),code_challenge_method:'S256',state:ctx.state,prompt:'select_account'},
      RedirectUri:REDIRECT,Sandbox:'RETAIL',TokenType:'code',TitleId:'1794566092'
    },'Xbox connexion');
    const uri=new URL(r.json.MsaOauthRedirect);
    if(uri.protocol!=='https:' || uri.hostname!=='login.live.com' || uri.username || uri.password || uri.port)throw new Error('Adresse Microsoft inattendue.');
    ctx.sessionId=r.headers?.['x-sessionid']; if(!ctx.sessionId)throw new Error('Session Xbox absente.');
    return {ctx,url:uri.href,expiresIn:600};
  }
  function redirect(ctx, value) {
    const uri=new URL(value), expected=new URL(REDIRECT);
    if(uri.origin!==expected.origin || uri.pathname!==expected.pathname || uri.username || uri.password || uri.hash) return null;
    if(ctx.used || Date.now()>ctx.expiresAt)throw new Error('Cette connexion a expiré. Recommencez.');
    const state=uri.searchParams.get('state') || '';
    if(state.length!==ctx.state.length || !crypto.timingSafeEqual(Buffer.from(state),Buffer.from(ctx.state)))throw new Error('Réponse Microsoft non liée à cette connexion.');
    if(uri.searchParams.has('error'))throw new Error('Connexion annulée ou refusée par Microsoft.');
    const code=uri.searchParams.get('code'); if(!code || code.length>8192)throw new Error('Code Microsoft absent.');
    ctx.used=true; return code;
  }
  async function exchange(ctx, code) {
    const r=await transport.postForm('https://login.live.com/oauth20_token.srf',{
      client_id:CLIENT_ID,code,code_verifier:ctx.verifier,grant_type:'authorization_code',redirect_uri:REDIRECT,scope:SCOPE
    });
    ctx.verifier='';
    if(r.status!==200 || !r.json?.access_token)throw failure('Microsoft',r);
    return {...r.json,authProvider:PROVIDER,clientId:CLIENT_ID,_sisu:ctx};
  }
  async function refresh(refreshToken) {
    const r=await transport.postForm('https://login.live.com/oauth20_token.srf',{
      client_id:CLIENT_ID,refresh_token:refreshToken,grant_type:'refresh_token',redirect_uri:REDIRECT,scope:SCOPE
    });
    if(r.status!==200 || !r.json?.access_token)throw failure('Microsoft renouvellement',r);
    return {...r.json,authProvider:PROVIDER,clientId:CLIENT_ID};
  }
  async function minecraft(tokens) {
    const ctx=tokens._sisu || await device();
    const authorization=await signed(ctx,'https://sisu.xboxlive.com/authorize',{
      AccessToken:'t='+tokens.access_token,AppId:CLIENT_ID,DeviceToken:ctx.deviceToken,ProofKey:ctx.proof,
      Sandbox:'RETAIL',SessionId:ctx.sessionId || null,SiteName:'user.auth.xboxlive.com',RelyingParty:'http://xboxlive.com',UseModernGamertag:true
    },'Xbox autorisation');
    const user=authorization.json.UserToken?.Token,title=authorization.json.TitleToken?.Token;
    if(!user || !title)throw new Error('Jetons Xbox incomplets.');
    const xsts=await signed(ctx,'https://xsts.auth.xboxlive.com/xsts/authorize',{
      Properties:{SandboxId:'RETAIL',UserTokens:[user],DeviceToken:ctx.deviceToken,TitleToken:title},RelyingParty:'rp://api.minecraftservices.com/',TokenType:'JWT'
    },'Xbox Minecraft');
    const uhs=xsts.json.DisplayClaims?.xui?.[0]?.uhs;
    if(!uhs || !xsts.json.Token)throw new Error('Identité Xbox absente.');
    const r=await transport.postJSON('https://api.minecraftservices.com/launcher/login',{
      platform:'PC_LAUNCHER',xtoken:'XBL3.0 x='+uhs+';'+xsts.json.Token
    },{Accept:'application/json'});
    if(r.status!==200 || !r.json?.access_token)throw failure('Minecraft',r);
    return r.json.access_token;
  }
  return {begin,redirect,exchange,refresh,minecraft};
}
module.exports={...create(),create,CLIENT_ID,REDIRECT,PROVIDER};
