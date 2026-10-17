'use strict';
/*  lib/config.js — fusion config livree (config.json a cote de main.js)
                        + config utilisateur (%APPDATA%\XRNLauncher\config.json)  */

const path = require('path');
const util = require('./util');

let cache = null;

/* Duree maximale d'inactivite avant de redemander une connexion. */
const SESSION_MAX_DAYS = 14;

function defaults() {
  return {
    microsoftClientId: '',
    sessionMaxDays: SESSION_MAX_DAYS,
    gameDir: path.join(util.appRoot(), 'minecraft'),
    javaPath: '',
    javaArgs: '',
    ramGB: 4,
    windowWidth: 1600,
    windowHeight: 920,
    fullscreen: false,
    gameWidth: 1280,
    gameHeight: 720,
    guiScale: 2,
    maxDownloads: 6,
    verifySha1: true,
    ambientSound: true,
    ambientVolume: 0.3,
    lastVersion: null,
    lastProfile: null,
    offlineProfiles: []
  };
}

function shipped() {
  // config.json livre avec l'application (surcharge par defaut).
  // __dirname n'existe pas dans le contexte DOM de NW.js : on tente plusieurs bases.
  const bases = [];
  try { if (typeof __dirname === 'string' && __dirname) bases.push(__dirname); } catch (e) {}
  try { if (process && process.cwd()) bases.push(process.cwd(), path.join(process.cwd(), 'lib')); } catch (e) {}
  for (const b of bases) {
    for (const rel of ['config.json', path.join('..', 'config.json')]) {
      const p = path.join(b, rel);
      if (util.exists(p)) { const j = util.readJSON(p, null); if (j) return j; }
    }
  }
  return {};
}
function userFile() { return path.join(util.appRoot(), 'config.json'); }

function load() {
  if (cache) return cache;
  const cfg = Object.assign(defaults(), shipped(), util.readJSON(userFile(), {}));
  // nettoyage des cles "//..." de commentaires
  for (const k of Object.keys(cfg)) if (k.charAt(0) === '/') delete cfg[k];
  if (!cfg.gameDir) cfg.gameDir = path.join(util.appRoot(), 'minecraft');
  cache = cfg;
  return cache;
}

function save(patch) {
  const cfg = Object.assign(load(), patch || {});
  util.writeJSON(userFile(), cfg);
  cache = cfg;
  return cfg;
}

/*  L'identifiant reellement utilise : celui de la config, sinon le repli. */
function clientId() {
  const id = (load().workingClientId || load().microsoftClientId || '').trim();
  return (id && id !== 'YOUR_CLIENT_ID') ? id : '';
}

function sessionMaxDays() {
  const n = Number(load().sessionMaxDays);
  return (n > 0 && n <= 365) ? n : SESSION_MAX_DAYS;
}

function hasClientId() { return !!clientId(); }

/*  Journalise dans le fichier de log du launcher. */
function trace(msg) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(util.appRoot(), 'logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'launcher.log'),
      new Date().toISOString() + '  [AUTH] ' + String(msg).slice(0, 300) + '\n', 'utf8');
  } catch (e) {}
}

module.exports = {
  trace, load, save, clientId, hasClientId, sessionMaxDays, defaults, userFile };