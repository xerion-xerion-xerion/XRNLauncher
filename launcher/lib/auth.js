'use strict';
/*  lib/auth.js — Connexion Microsoft (OAuth 2.0 Device Code)
                    -> Xbox Live -> XSTS -> Minecraft Services
                    Stocke la session dans %APPDATA%\XRNLauncher\profiles.json */

const path = require('path');
const util = require('./util');
const cfg  = require('./config');
const http = require('./http');

/* ---------------------------------------------------------------
 * Tenants testes dans l'ordre. "common" accepte aussi bien les
 * comptes personnels que les comptes entreprise, donc une app
 * multi-locataire fonctionne partout. On retombe sur "consumers"
 * pour les apps enregistrees uniquement dans le tenant MSA.
 * ------------------------------------------------------------- */
/*  Ordre d'essai. Une application peut etre visible depuis un
    tenant et pas un autre : on essaie donc plusieurs points d'entree
    jusqu'a ce que l'un accepte la demande.
      common        : comptes personnels + toutes les organisations
      organizations : comptes ecole/entreprise
      consumers     : uniquement les comptes Microsoft personnels
 ------------------------------------------------------------------ */
/*  ORDRE CRITIQUE.
    Minecraft se joue avec des comptes Microsoft personnels : on doit
    donc interroger "consumers" en premier. Si on demarre par
    "organizations", celui-ci repond vite (pour les comptes d'entreprise)
    et le code est emis pour ce tenant-la : Microsoft refuse alors la
    connexion d'un compte personnel avec le message
    "vous ne pouvez pas vous connecter ici avec un compte personnel".
    On ne prend donc jamais un code emis pour un mauvais tenant.
 ------------------------------------------------------------------ */
const TENANTS = ['consumers', 'common', 'organizations'];

/*  Si l'identifiant du creerateur est refuse, on retente avec l'app
    publique de Microsoft : l'utilisateur n'a alors rien a configurer.  */
const cfgmod = require('./config');

async function deviceCodeFor(id, tenant) {
  const { status, json, text } = await postDeviceCode(tenant, id);
  if (status === 200 && json && json.device_code) return json;
  return { __ko: true, status, msg: (json && (json.error_description || json.error)) || text || '' };
}
function base(tenant) { return 'https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0'; }

/*  Tenant ajoute a la liste d'essai quand il est renseigne dans la
    configuration. Utile quand Microsoft est lent a propager : on peut
    interroger directement le repertoire de l'application.            */
/*  XboxLive.signin est un "service scope" : Microsoft ne le declare
    pas dans l'application, il l'accorde automatiquement — mais uniquement
    via l'endpoint /consumers. Sur un tenant precis, Microsoft refuse
    le scope (AADSTS650053). Donc : /consumers en premier, toujours.  */
function tenantsList() { return TENANTS; }
const OAUTH_SCOPE  = 'XboxLive.signin offline_access';
const XBL_URL      = 'https://user.auth.xboxlive.com/user/authenticate';
const XSTS_URL     = 'https://xsts.auth.xboxlive.com/xsts/authorize';
const MC_LOGIN_URL = 'https://api.minecraftservices.com/authentication/login_with_xbox';
const MC_ME_URL    = 'https://api.minecraftservices.com/minecraft/profile';
const MC_ENT_URL   = 'https://api.minecraftservices.com/entitlements/mcstore';
const MC_MSA_URL   = 'https://api.minecraftservices.com/minecraft/has_legacy_entitlement';
const XBL_PROFILE_URL = 'https://profile.xboxlive.com/users/me';

function store()  { return path.join(util.appRoot(), 'profiles.json'); }
function load()   { return util.readJSON(store(), { accounts: [] }); }
function persist(o) { util.writeJSON(store(), o); }

/* Traduit les erreurs Microsoft en francais clair.
   C'est ici que se joue 90 % de la confusion des utilisateurs.
   L'ordre compte : on teste d'abord les codes les plus parlants,
   car un seul appel peut en renvoyer plusieurs.                      */
function explain(text, code) {
  const t = String(text || '');

  /* 50059 : l'application existe mais n'a pas les droits demandes.
     C'est l'erreur la plus frequente apres une creation d'app.      */
  /* 70002 : l'application n'est pas encore visible depuis ce tenant.
     C'est normal juste apres sa creation ou un changement de type de
     comptes : la propagation peut prendre plusieurs heures.          */
  /* 9002346 : l'application est bien reglee sur "comptes Microsoft
     personnels uniquement" (donc le reglage est bon), et Microsoft
     demande qu'on passe par /consumers.                                */
  /* 650053 : l'application n'a pas declare la permission XboxLive.
     C'est l'etape "Autorisations API" du portail qui a ete oubliee. */
  if (/AADSTS650053/i.test(t))
    return "Microsoft refuse cette voie-la : la permission XboxLive.signin n'est accordee que via l'endpoint /consumers, qui n'est pas encore ouvert pour ton application. Ce n'est pas reglable depuis le portail : c'est une attente.";

  /* 70000 : ce code de connexion a deja servi. C'est un doublon
     d'interrogation cote launcher, pas une erreur du compte. */
  /* 403 "Invalid app registration" renvoye par api.minecraftservices.com.
     C'est le verrou final : Mojang n'accepte que les applications
     enregistrees ET approuvees dans leur programme partenaires.       */
  if (/invalid app registration|AADSTS900023|aka\.ms\/AppRegInfo/i.test(t))
    return "Mojang refuse l'echange final : l'application du launcher n'est pas approuvee dans le programme partenaires Mojang (https://aka.ms/AppRegInfo). Cette approbation se demande par formulaire et met plusieurs semaines. Ce n'est reglable ni dans le portail Microsoft ni depuis le launcher. Utilise le mode solo, ou le mode par jeton (Authlib-Injector).";

  if (/AADSTS70000/i.test(t))
    return "Ce code de connexion a deja ete utilise. Relance la connexion pour obtenir un nouveau code.";

  if (/AADSTS9002346/i.test(t))
    return "Ton application est correctement configuree pour les comptes Microsoft personnels. Microsoft doit encore l'enregistrer aupres de ces comptes : c'est en cours. Reviens dans une heure, ca fonctionnera sans rien changer.";

  if (/AADSTS70002/i.test(t))
    return "Microsoft n'a pas encore enregistre cette application. Si tu viens de la creer ou de changer ses types de comptes, c'est normal : la propagation prend de quelques minutes a quelques heures. Reessaie plus tard, le launcher est pret.";

  if (/AADSTS50059/i.test(t))
    return "Microsoft refuse cet identifiant pour la connexion Minecraft. Trois causes possibles, dans l'ordre de probabilite : 1) tu as copie l'ID d'objet au lieu de l'ID d'application (client) ; 2) l'application n'a pas les permissions deleguees XboxLive.signin et offline_access ; 3) l'application n'accepte pas les comptes Microsoft personnels. Le guide ci-dessous indique quoi verifier.";

  /* 700016 : l'application est introuvable depuis ce tenant.        */
  if (/AADSTS700016|not found in the directory/i.test(t))
    return "Microsoft ne trouve pas cette application. Verifie que tu as copie l'ID d'application (client) et non l'ID d'objet, puis que l'application autorise les comptes Microsoft personnels.";

  if (/AADSTS50020|does not exist in tenant|external user/i.test(t))
    return "Ton identifiant est dans le mauvais tenant. L'application doit etre creee dans TON repertoire (centre d'administration Microsoft Entra -> Inscriptions d'applications).";

  /* 900144 = le parametre client_id manque completement.            */
  if (/AADSTS900144/i.test(t) || (!t && code === 'identifiant'))
    return "Aucun identifiant d'application enregistre. Colle-le dans le champ de l'onglet Connexion.";

  if (/invalid_client|AADSTS7000215/i.test(t))
    return "Identifiant d'application refuse par Microsoft. Verifie que tu as bien copie l'ID d'application (client) et non l'ID d'objet.";

  if (/AADSTS50076|AADSTS50079|MFA|multi-factor/i.test(t))
    return "La connexion demande une verification en deux etapes. Valide-la dans la fenetre du navigateur.";

  /* Erreur de consentement : Microsoft refuse qu'un utilisateur donne
     son accord a une application premiere partie (celle de Microsoft).
     C'est le symptome d'un identifiant emprunte.                    */
  if (/first party application|not permitted to consent|pre-authorization/i.test(t))
    return "Cet identifiant appartient a Microsoft, pas a ce launcher. Microsoft interdit aux utilisateurs d'accorder leur accord a ce type d'application : il ne peut pas servir. Il faut un identifiant issu de VOTRE propre application.";

  /* 7000012 / invalid_grant : le jeton de reconnexion a ete revoque
     par Microsoft ou a depasse sa duree de vie.                       */
  if (/AADSTS7000012|AADSTS700082|invalid_grant/i.test(t))
    return "La reconnexion automatique a echoue : Microsoft n'accepte plus cette session. Clique sur Se connecter pour en creer une nouvelle (ça prend 10 secondes).";

  if (/AADSTS65001|unauthorized_client/i.test(t))
    return "Ton compte n'a pas les droits sur cette application. Verifie les 'Types de comptes pris en charge' lors de la creation.";

  if (/interaction_required|consent/i.test(t))
    return "Le compte doit accepter l'autorisation. Reconnecte-toi et accepte la demande de consentement.";
  if (/not exist|introuvable/i.test(code || ''))
    return "Cette version de Minecraft n'est pas installee. Va dans Versions pour la telecharger.";
  return null;
}

class AuthError extends Error {
  constructor(msg, code) { super(msg); this.code = code || 'auth'; }
}

/* ---------------------------------------------------------------
 * 1. Device Code : l'utilisateur va sur microsoft.com/link et saisit
 *    un code. Aucun secret client requis (flow "public client").
 * ------------------------------------------------------------- */
async function postDeviceCode(tenant, id) {
  return http.postForm(base(tenant) + '/devicecode', {
    client_id: id,
    scope: OAUTH_SCOPE
  });
}

/* Verifie un identifiant d'application et renvoie un verdict lisible. */
async function checkClientId(clientId) {
  const id = String(clientId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return { ok: false, level: 'warn', label: 'Format incorrect',
             detail: "Un identifiant Microsoft a la forme 00000000-0000-0000-0000-000000000000 (36 caracteres). Tu as probablement copie autre chose." };

  const essais = [];
  for (const tenant of tenantsList()) {
    const { status, json, text } = await postDeviceCode(tenant, id);
    if (status === 200 && json && json.device_code)
      return { ok: true, level: 'ok', label: 'Identifiant valide',
               detail: "Microsoft accepte cet identifiant. Utilise « Se connecter » pour obtenir ton code.",
               tenant, expiresIn: json.expires_in, interval: json.interval };
    const msg = (json && (json.error_description || json.error)) || text || '';
    essais.push({ tenant, msg: String(msg), code: json && json.error });
  }

  /* Microsoft renvoie exactement la meme erreur pour un identifiant
     invente : impossible d'affirmer que l'application existe.        */
  const all = essais.map(e => e.msg).join(' | ');
  const clair = explain(all, 'verif');
  const brut = essais
    .map(e => e.tenant + ' : ' + (e.code || String(e.msg).match(/AADSTS\d+/) || '?'))
    .join('   |   ');
  return {
    ok: false,
    level: 'err',
    label: 'Identifiant refuse par Microsoft',
    detail: clair || all.slice(0, 400),
    brut,
    guide: 'msGuide'
  };
}

async function startDeviceCode(clientId) {
  // Garde-fou : sans identifiant valide, Microsoft renvoie AADSTS900144
  const id = String(clientId || '').trim();
  if (id.length < 20) {
    throw new AuthError(
      "Identifiant Microsoft absent. Ouvre l'onglet Connexion et colle l'ID d'application dans le champ prévu.",
      'no-client-id'
    );
  }

  let dernier = null;
  const messages = [];
  /*  Microsoft met parfois plusieurs minutes a enregistrer une nouvelle
      application, et davantage apres un changement de type de comptes.
      Plutot que d'echouer, on retente quelques fois sur une minute.    */
  const ATTENTES = [0, 8000, 15000, 25000];


  for (let essai = 0; essai < ATTENTES.length; essai++) {
    if (ATTENTES[essai]) await new Promise(r => setTimeout(r, ATTENTES[essai]));
    dernier = null;
    messages.length = 0;

    for (const tenant of tenantsList()) {
      const json = await deviceCodeFor(id, tenant);
      if (json.__ko) {
        dernier = { status: json.status, msg: json.msg };
        messages.push(String(json.msg));
        continue;
      }
      // premier point d'entree qui repond : on prend son code
      return {
        clientId: id,
        tenant,
        deviceCode: json.device_code,
        userCode: json.user_code,
        verificationUri: json.verification_uri,
        /*  Microsoft renvoie verification_uri_complete sur certaines
            applications seulement. Depuis peu il sert une URL
            "https://www.microsoft.com/link" qui n'accepte pas le
            parametre ?otc= : on n'ouvre donc que l'adresse nue et
            l'utilisateur saisit le code, que le launcher affiche
            deja en grand.                                                */
        verificationUriComplete: json.verification_uri_complete || null,
        verificationUriPropre: json.verification_uri,
        interval: json.interval || 5,
        expiresIn: json.expires_in || 900
      };
    }
  }

  /*  Aucun point d'entree utilisable n'a repondu.                       */
  const clair = explain(
    messages.some(m => /AADSTS9002346/i.test(m)) ? 'AADSTS9002346'
      : messages[messages.length - 1] || '',
    'identifiant'
  ) || explain('AADSTS70002', 'identifiant');

  throw new AuthError(clair || ('Demande de connexion refusee (' + dernier.status + ') : ' + String(dernier.msg).slice(0, 200)), 'identifiant');
}

/* 2. Echange du jeton (bloquant, a appeler en boucle) */
async function pollDeviceCode(clientId, deviceCode, interval, tenant) {
  await new Promise(r => setTimeout(r, interval * 1000));
  const { status, json } = await http.postForm(base(tenant || 'common') + '/token', {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
  });

  if (status === 200 && json && json.access_token) {
    return { done: true, tokens: json };
  }
  const err = (json && json.error) || ('http_' + status);
  if (err === 'authorization_pending') return { done: false, slowDown: false };
  if (err === 'slow_down')           return { done: false, slowDown: true };
  if (err === 'expired_token')       throw new AuthError('Le code de connexion a expire. Relancez la connexion.', 'expired');
  if (err === 'authorization_declined') throw new AuthError('Connexion refusee.', 'declined');
  const msg = (json && (json.error_description || json.error)) || err;
  const clair = explain(msg, err);
  if (clair) throw new AuthError(clair, err);
  throw new AuthError('Connexion echouee : ' + msg, err);
}

/* 3. Rafraichissement automatique */
async function refresh(refreshToken) {
  const c = cfg.load();
  const clientId = c.workingClientId || c.microsoftClientId;
  let dernier = null;
  for (const tenant of tenantsList()) {
    const { status, json, text } = await http.postForm(base(tenant) + '/token', {
      client_id: clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: OAUTH_SCOPE
    });
    if (status === 200 && json && json.access_token) return json;
    dernier = { status, msg: (json && (json.error_description || json.error)) || text || '' };
  }
  const clair = explain(dernier.msg, 'refresh');
  throw new AuthError(clair ? clair : 'Session expiree, reconnectez-vous. ' + String(dernier.msg).slice(0, 160), 'refresh');
}

/*  Etape commune : l'authentification Xbox Live. Elle ne depend d'aucun
    accord de Mojang, seulement de l'enregistrement de l'application
    aupres de Microsoft.                                                 */
async function xblTokenFor(msaAccessToken) {
  const trace = (m) => { try { cfg.trace(m); } catch (e) {} };
  const xbl = await http.postJSON(XBL_URL, {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: 'd=' + msaAccessToken
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  }, { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' });

  trace('XBL HTTP ' + xbl.status + ' ' + JSON.stringify(xbl.json || {}).slice(0, 220));
  if (xbl.status !== 401 && xbl.status !== 200) {
    throw new AuthError('Xbox Live a refuse la demande (' + xbl.status + ') : ' + String((xbl.json && xbl.json.XErr) || (xbl.text || '')).slice(0, 160), 'xbl');
  }
  if (xbl.status === 401) {
    const reason = xbl.json && xbl.json.XErr ? xbl.json.XErr : '';
    const msg = String(reason).includes('2148916233')
      ? 'Ce compte Microsoft ne possede pas de profil Xbox. Créez-en un sur xbox.com.'
      : 'Compte Microsoft rejete par Xbox Live.';
    trace('XBL 401 XErr=' + reason);
    throw new AuthError(msg, 'xbl');
  }
  return xbl.json.Token;
}

/*  Connexion Xbox seule, sans passer par les services Minecraft.

    L'approbation de Mojang ne concerne que api.minecraftservices.com.
    Tout ce qui est Xbox Live fonctionne avec n'importe quelle
    application Azure enregistree : on obtient donc le vrai gamertag,
    l'avatar et l'identifiant Xbox, et le jeu se lance en mode
    hors-ligne sous ce nom. Ce que l'approbation seule apporte en
    plus : le jeton Minecraft, donc les serveurs en ligne et Realms.  */
async function toXbox(msaAccessToken) {
  const trace = (m) => { try { cfg.trace(m); } catch (e) {} };
  const xblToken = await xblTokenFor(msaAccessToken);

  const xsts = await http.postJSON(XSTS_URL, {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  }, { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' });

  trace('XSTS(Xbox) HTTP ' + xsts.status + ' ' + JSON.stringify(xsts.json || {}).slice(0, 200));
  if (xsts.status !== 200) {
    const e = (xsts.json && xsts.json.XErr) || xsts.status;
    throw new AuthError('Xbox a refuse la session (' + e + ').', 'xsts');
  }
  const uhs = xsts.json.DisplayClaims.xui[0].uhs;
  const xid = xsts.json.DisplayClaims.xui[0].xid || '';

  const prof = await http.postJSON(XBL_PROFILE_URL, null, {
    'Authorization': 'XBL3.0 x=' + uhs + ';' + xsts.json.Token,
    'Accept': 'application/json'
  }, 'GET');

  trace('profil Xbox HTTP ' + prof.status);
  if (prof.status !== 200 || !prof.json || !prof.json.displayName) {
    throw new AuthError('Impossible de lire le profil Xbox (' + prof.status + ') : ' + String(prof.text || '').slice(0, 160), 'xbox');
  }

  return {
    name: prof.json.displayName,
    xuid: String(prof.json.id || xid || ''),
    avatarUrl: prof.json.gamerpic || '',
    avatarSmall: prof.json.gamepic || ''
  };
}

/* 4. Xbox Live -> XSTS -> Minecraft */
async function toMinecraft(msaAccessToken) {
  const trace = (m) => { try { cfg.trace(m); } catch (e) {} };
  const xblToken = await xblTokenFor(msaAccessToken);

  const xsts = await http.postJSON(XSTS_URL, {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  }, { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' });

  trace('XSTS HTTP ' + xsts.status + ' ' + JSON.stringify(xsts.json || {}).slice(0, 260));
  if (xsts.status !== 200) {
    const e = (xsts.json && xsts.json.XErr) || xsts.status;
    const msg = String(e).includes('2148916238')
      ? 'Ce compte n\'a pas de compte Minecraft associe.'
      : 'XSTS a refuse la session (' + e + ').';
    throw new AuthError(msg, 'xsts');
  }
  trace('XSTS ok, uhs=' + String(xsts.json.DisplayClaims.xui[0].uhs).slice(0, 12));
  const uhs = xsts.json.DisplayClaims.xui[0].uhs;

  const mc = await http.postJSON(MC_LOGIN_URL, { identityToken: 'XBL3.0 x=' + uhs + ';' + xsts.json.Token });
  trace('MC login HTTP ' + mc.status + ' ' + JSON.stringify(mc.json || {}).slice(0, 200));
  if (mc.status !== 200 || !mc.json || !mc.json.access_token) {
    throw new AuthError('Minecraft a refuse la connexion (' + mc.status + ') : ' + String((mc.json && mc.json.errorMessage) || mc.text || '').slice(0, 160), 'mc');
  }
  return mc.json.access_token;
}

async function profile(mcToken) {
  const { status, json, text } = await http.postJSON(MC_ME_URL + '?x=1', null,
    { 'Authorization': 'Bearer ' + mcToken }, 'GET');
  if (status !== 200 || !json || !json.id) {
    throw new AuthError('Impossible de lire le profil Minecraft (' + status + ') : ' + (text || '').slice(0, 160));
  }
  return {
    id: json.id,
    name: json.name,
    skinUrl: (json.skins && json.skins[0] && json.skins[0].url) || '',
    capeUrl: (json.capes && json.capes[0] && json.capes[0].url) || '',
    firstJoined: json.firstJoined || 0
  };
}

async function entitlements(mcToken) {
  const { status, json } = await http.postJSON(MC_ENT_URL, null,
    { 'Authorization': 'Bearer ' + mcToken }, 'GET');
  if (status !== 200 || !json) return { ownsGame: false, ownsLegacy: false };
  const items = json.items || [];
  return {
    ownsGame: items.some(i => i.sku === 'minecraft' || i.sku === 'minecraft_dungeons'),
    ownsLegacy: (await http.postJSON(MC_MSA_URL, null, { 'Authorization': 'Bearer ' + mcToken }, 'GET')).status === 200
  };
}

function publicAccount(acc) {
  return {
    type: acc.type,
    name: acc.name,
    id: acc.id,
    skinUrl: acc.skinUrl || '',
    avatarUrl: acc.avatarUrl || '',
    capeUrl: acc.capeUrl || '',
    userType: acc.userType || 'msla',
    isLegacy: !!acc.isLegacy
  };
}

module.exports = {
  explain, checkClientId,
  startDeviceCode, pollDeviceCode, refresh, toMinecraft, toXbox, xblTokenFor, profile, entitlements,
  load, persist, store, publicAccount, AuthError
};