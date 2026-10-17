'use strict';
/*  lib/authlib.js — Authlib-Injector
 *
 *  Le protocole Microsoft exige une application enregistree ET approuvee
 *  par Mojang. Un compte personnel ne peut pas obtenir cette approbation,
 *  et aucun portail ne permet de la demander soi-meme.
 *
 *  Authlib-Injector passe par la : le launcher ne demande plus rien a
 *  Microsoft, il utilise un jeton Minecraft que l'utilisateur fournit.
 *  Le jeu est demarre avec un agent Java (-javaagent) qui intercepte
 *  l'authentification et la remplace par celle du serveur de session.
 *
 *  Deux modes :
 *   - jeton        : l'utilisateur colle un jeton Minecraft
 *   - identifiants : l'utilisateur colle un couple utilisateur / mot de passe
 *                    d'un serveur authlib-injector, qui gere le rafraichissement
 */

const path = require('path');
const util = require('./util');
const http = require('./http');

/*  Serveur de session officiel de Mojang, utilise par defaut.            */
const DEFAULT_API = 'https://sessionserver.mojang.com/session/minecraft';

/*  Le jar est livre avec le launcher, dans lib\assets.                   */
function jarPath() {
  return path.join(__dirname, 'assets', 'authlib-injector.jar');
}

function apiUrl() {
  const c = util.readJSON(path.join(util.appRoot(), 'config.json'), {});
  return String((c && c.authlibApi) || DEFAULT_API).replace(/\/+$/, '');
}

/*  Base64 portable (le launcher tourne sous Node mais on evite Buffer
    pour rester compatible avec le contexte DOM de NW.js).                 */
function b64(str) {
  return Buffer.from(String(str), 'utf8').toString('base64');
}

/*  Donnees transmises a l'agent. Le format est impose par Authlib-Injector.
    "data" est le JSON encode en base64.                                    */
function injectorData(acc) {
  const payload = {
    accessToken: acc.accessToken,
    clientToken: acc.clientToken || util.appRoot().replace(/[^a-zA-Z0-9]/g, '').slice(-16),
    uuid: String(acc.uuid || acc.id || '').replace(/-/g, ''),
    userType: acc.userType || 'msa',
    userProperties: acc.userProperties || {},
    xuid: acc.xuid || '',
    meta: { type: 'user', agent: 'Minecraft' },
    minecraftProfile: acc.name ? { name: acc.name } : undefined
  };
  return b64(JSON.stringify(payload));
}

/*  Argument JVM complet. Le chemin doit etre absolu et le jar doit
    exister, sinon Minecraft refuse de demarrer.                            */
function javaAgentArg(acc) {
  const jar = jarPath();
  if (!util.exists(jar)) {
    const e = new Error("Fichier authlib-injector.jar introuvable. Reinstalle le launcher.");
    e.code = 'no-injector';
    throw e;
  }
  const data = 'apiUrl=' + apiUrl() + ';data=' + injectorData(acc);
  return '-javaagent:' + jar + '=' + data;
}

/*  Recupere le profil Minecraft a partir d'un jeton.
    Retourne { id, name, skinUrl } ou leve une erreur explicite.           */
/*  Mojang ne donne pas le profil a partir d'un jeton seul : il faut
    l'UUID. On interroge api.mojang.com, qui n'exige aucune approbation
    d'application (contrairement a api.minecraftservices.com).         */
const PROFILE_API = 'https://api.mojang.com/session/minecraft/profile/';

function uuidPropre(u) {
  return String(u || '').trim().replace(/-/g, '');
}

async function profileFromToken(token, uuid, name) {
  const tok = String(token || '').trim();
  if (tok.length < 40) throw new Error('Jeton trop court.');
  const id = uuidPropre(uuid);
  if (!/^[0-9a-f]{32}$/i.test(id))
    throw new Error("UUID invalide. C'est le 32 caracteres trouve dans l'onglet profil de Mojang.");

  let nom = String(name || '').trim();
  let skin = '';
  try {
    const r = await http.getJSON(PROFILE_API + id, { headers: { 'User-Agent': 'Minecraft' } });
    if (r && r.id) { nom = r.name || nom; skin = skinned(r.properties || {}); }
  } catch (e) {
    /* 204 = UUID inconnu : on garde le pseudo saisi a la main. */
    if (!nom) throw new Error('UUID inconnu de Mojang et aucun pseudo fourni.');
  }
  return {
    id: id,
    uuid: id,
    name: nom || 'Joueur',
    userType: 'msa',
    skinUrl: skin,
    accessToken: tok
  };
}

function skinned(props) {
  const p = (props && props.skins) || [];
  const hit = p.find(x => /^[0-9a-f]{64}$/.test(x.value || '')) || p[0];
  return hit ? 'https://crafatar.com/skins/' + hit.value : '';
}

/*  Verifie des identifiants (login direct sur un serveur authlib-injector) */
async function loginWithCredentials(user, pass, api) {
  const base = (api || apiUrl()).replace(/\/+$/, '');
  const body = {
    agent: { name: 'Minecraft', version: 1 },
    username: String(user || '').trim(),
    password: String(pass || ''),
    clientToken: 'xrnlauncher',
    requestUser: true
  };
  const { status, json, text } = await http.postJSON(base + '/authserver/authenticate', body);
  if (status !== 200 || !json || !json.accessToken) {
    throw new Error(mauvaisIdent(json, text));
  }
  return {
    id: (json.selectedProfile && json.selectedProfile.id) || '',
    uuid: (json.selectedProfile && json.selectedProfile.id) || '',
    name: (json.selectedProfile && json.selectedProfile.name) || json.username,
    userType: json.userType || 'legacy',
    accessToken: json.accessToken,
    clientToken: json.clientToken || 'xrnlauncher',
    refreshToken: json.refreshToken || '',
    selectedProfile: json.selectedProfile || null
  };
}

function mauvaisIdent(json, text) {
  const cause = (json && (json.errorMessage || json.error)) || text || '';
  const t = String(cause);
  if (/ForbiddenException|invalid|Invalid/i.test(t))
    return "Identifiants refuses par le serveur de session.";
  if (/rate/i.test(t))
    return "Trop de tentatives. Patiente quelques minutes avant de reessayer.";
  return "Connexion refusee : " + t.slice(0, 140);
}

/*  Rafraichit un jeton via le jeton de rafraichissement du serveur.       */
async function refresh(acc) {
  if (!acc.refreshToken) throw new Error('Aucun jeton de rafraichissement.');
  const base = apiUrl();
  const body = {
    clientToken: acc.clientToken || 'xrnlauncher',
    accessToken: acc.accessToken,
    requestUser: true
  };
  const { status, json } = await http.postJSON(base + '/authserver/refresh', body);
  if (status !== 200 || !json || !json.accessToken) throw new Error('Rafraichissement impossible.');
  const p = json.selectedProfile || acc.selectedProfile || {};
  return Object.assign({}, acc, {
    accessToken: json.accessToken,
    clientToken: json.clientToken || acc.clientToken,
    id: p.id || acc.id,
    uuid: p.id || acc.uuid,
    name: p.name || acc.name
  });
}

module.exports = {
  DEFAULT_API, apiUrl, jarPath, javaAgentArg, injectorData,
  profileFromToken, loginWithCredentials, refresh,
  exists() { return util.exists(jarPath()); }
};