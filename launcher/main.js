window.__XRN_START = 'main.js execute';
'use strict';
/*  main.js — CONTEXTE NODE (NW.js)
    Expose l'API systeme a l'interface via window.XRN.
    Rien de tout cela n'existe dans un simple navigateur : l'UI detecte
    window.XRN et bascule automatiquement en "mode apercu".               */

const fs    = require('fs');
const path  = require('path');
const { EventEmitter } = require('events');
const { spawn, spawnSync } = require('child_process');

const util   = require('./lib/util');
const cfgm   = require('./lib/config');
const http   = require('./lib/http');
const auth   = require('./lib/auth');
const game   = require('./lib/game');
const files  = require('./lib/files');
const servers = require('./lib/servers');
const alib   = require('./lib/authlib');
const mods   = require('./lib/mods');

util.ensureDir(util.appRoot());

// Repertoire de l'application : __dirname n'existe pas dans tous les contextes NW.js
function appDir() {
  try { if (typeof __dirname === 'string' && __dirname) return __dirname; } catch (e) {}
  try { if (typeof process !== 'undefined' && process.cwd()) return process.cwd(); } catch (e) {}
  return '.';
}
const pkg = util.readJSON(path.join(appDir(), 'package.json'), { version: '0.0.0' });
const bus = new EventEmitter();
bus.setMaxListeners(64);

/* Etat de session en memoire ---------------------------------------- */
const session = {
  login_clientId: null,  // identifiant ayant produit le device code en cours
  login: null,
  polling: null,       // echange de device_code en cours          // { deviceCode, userCode, verificationUri, interval, expiresAt, timer }
  account: null,        // profil connected
  resuming: false,      // reconnexion en cours au demarrage
  expired: null,        // { name, reason } -> une reconnexion humaine est requise
  game: null            // { pid, version }
};

function me() { return session.account; }

/* ------------------------------------------------------------------ *
 *  Instance unique
 *
 *  NW.js n'accepte qu'une seule instance : un second double-clic
 *  demarre puis se ferme aussitot, ce qui donne l'impression que
 *  l'application plante. On detecte ce cas et on ramene simplement la
 *  fenetre deja ouverte au premier plan.
 * ------------------------------------------------------------------ */
function lockPath() { return path.join(util.appRoot(), 'launcher.lock'); }

/*  Nom de l'image d'un processus, ou null s'il n'existe plus.
    tasklist est livre avec Windows et demarre en quelques dizaines de
    millisecondes, contrairement a wmic qui est plus lourd.           */
function imageDuProcess(pid) {
  try {
    const r = spawnSync('tasklist',
      ['/FI', 'PID eq ' + pid, '/NH', '/FO', 'CSV', '/V'],
      { encoding: 'utf8', windowsHide: true, timeout: 8000 });
    if (!r || r.status !== 0 || !r.stdout) return null;
    const ligne = r.stdout.split(/\r?\n/).find(function (l) {
      return new RegExp('"' + pid + '"').test(l);
    });
    if (!ligne) return null;
    const m = /^"([^"]*)","(\d+)"/.exec(ligne.trim());
    return m ? m[1] : null;
  } catch (e) { return null; }
}

/*  Un numero de processus est recycle par Windows des qu'il se libere.
    Un lock laisse par un plantage peut donc designer, plus tard, un
    programme sans rapport. Sans cette verification, le launcher voit
    un PID vivant, tente de ramener une fenetre inexistante, puis se
    ferme : il parait ne pas demarrer du tout. On exige donc que le
    processus porte bien le nom de notre executable.                 */
function instanceVivante() {
  try {
    const pid = parseInt(fs.readFileSync(lockPath(), 'utf8').trim(), 10);
    if (!pid || pid === process.pid) return null;
    try { process.kill(pid, 0); } catch (e) { return null; }
    const img = imageDuProcess(pid);
    if (!img) return null;
    const attendu = path.basename(process.execPath).toLowerCase();
    const trouve  = img.toLowerCase();
    if (trouve !== attendu && trouve !== sansExt(attendu)) return null;
    return pid;
  } catch (e) { return null; }
}

function sansExt(nom) {
  return nom.replace(/\.exe$/, '');
}

/*  WScript.Shell.AppActivate accepte un identifiant de processus :
    aucunequote a echapper, contrairement a SetForegroundWindow.        */
function remonterFenetre(pid) {
  try {
    spawn('powershell',
      ['-NoProfile', '-WindowStyle', 'Hidden', '-Command',
       '(New-Object -ComObject WScript.Shell).AppActivate(' + pid + ')'],
      { detached: true, stdio: 'ignore' }).unref();
  } catch (e) {}
}

const dejaOuvert = instanceVivante();
if (dejaOuvert) {
  remonterFenetre(dejaOuvert);
  setTimeout(function () { process.exit(0); }, 800);
} else {
  try { fs.writeFileSync(lockPath(), String(process.pid), 'utf8'); } catch (e) {}
  process.on('exit', function () {
    /*  On ne supprime le lock que s'il est encore le nôtre. Sinon une
        ancienne instance qui se termine à cet instant effacerait le
        verrou de la nouvelle, et deux instances pourraient tourner
        en même temps.                                                  */
    try {
      const pid = parseInt(fs.readFileSync(lockPath(), 'utf8').trim(), 10);
      if (pid === process.pid) fs.unlinkSync(lockPath());
    } catch (e) {}
  });
}

/* ------------------------------------------------------------------ */
/*  API exposed a l'UI                                                */
/* ------------------------------------------------------------------ */
const XRN = {
  isDesktop: true,
  version: pkg.version,
  platform: process.platform,
  arch: process.arch,

  /* evenements : XRN.on('dl:progress', fn) */
  on(evt, fn) { bus.on(evt, fn); },
  off(evt, fn) { bus.off(evt, fn); },
  emit(evt, data) { bus.emit(evt, data); },

  /* ---------------------------------------------------------------- */
  env: {
    info() {
      const c = cfgm.load();
      return {
        version: pkg.version,
        userData: util.appRoot(),
        gameDir: c.gameDir,
        gameDirExists: util.exists(c.gameDir),
        hasClientId: cfgm.hasClientId(),
        clientIdMasked: (c.microsoftClientId || '').slice(0, 6) + '…',
        quick: files.quickFolders()
      };
    },
    config() { return cfgm.load(); },
    saveConfig(patch) { return cfgm.save(patch); },
    openFolder(p) { return util.openExplorer(p); },
    selectInExplorer(p) { return util.openExplorer(p, true); },
    openUrl(url) { return util.openUrl(url); },
    revealGameDir() { return util.openExplorer(cfgm.load().gameDir); },
    human: util.human,
    userDataPath: util.appRoot()
  },

  /* ---------------------------------------------------------------- */
  auth: {
    accounts() {
      const db = auth.load();
      return db.accounts.map(auth.publicAccount);
    },
    remove(id) {
      const db = auth.load();
      db.accounts = db.accounts.filter(a => a.id !== id);
      auth.persist(db);
      if (session.account && session.account.id === id) session.account = null;
      return auth.load().accounts.map(auth.publicAccount);
    },
    hasClientId() { return cfgm.hasClientId(); },

    /* ---------- Authlib-Injector ---------- */
    authlibReady() { return alib.exists(); },
    authlibApi() { return alib.apiUrl(); },

    /* Colle un jeton Minecraft : on lit le profil reel sur le serveur */
    async addToken(token, uuid, name) {
      let p;
      try {
        p = await alib.profileFromToken(token, uuid, name);
      } catch (e) {
        const e2 = new Error(String(e.message || e).slice(0, 200));
        e2.code = 'bad-token';
        throw e2;
      }
      return saveAuthlibAccount(Object.assign({ clientToken: 'xrnlauncher' }, p), 'token');
    },

    /* Identifiants d'un serveur authlib-injector : le serveur gere le
       rafraichissement, donc la session dure.                            */
    async addCredentials(user, pass, api) {
      const p = await alib.loginWithCredentials(user, pass, api);
      return saveAuthlibAccount(p, 'yggdrasil');
    },

    /* Verifie un identifiant sans lancer la connexion (bouton "Tester") */
    check(id) { return auth.checkClientId(String(id || '').trim()); },

    async begin() {
      if (!cfgm.hasClientId()) {
        const e = new Error("Identifiant Microsoft absent : colle-le dans le champ de l'onglet Connexion.");
        e.code = 'no-client-id';
        throw e;
      }
      const info = await auth.startDeviceCode(cfgm.clientId());
      session.login = {
        clientId: info.clientId,
        deviceCode: info.deviceCode,
        userCode: info.userCode,
        verificationUri: info.verificationUri,
        verificationUriComplete: info.verificationUriComplete,
        interval: info.interval,
        tenant: info.tenant,
        expiresAt: Date.now() + info.expiresIn * 1000
      };
      XRN.report('AUTH', 'devicecode ok | client=' + String(info.clientId).slice(0, 8) +
        ' tenant=' + info.tenant + ' code=' + info.userCode);
      const url = info.verificationUriPropre || info.verificationUriComplete || info.verificationUri;
      util.openUrl(url);
      return {
        userCode: info.userCode,
        verificationUri: info.verificationUri,
        verificationUriComplete: info.verificationUriComplete,
        tenant: info.tenant,
        // si le seul point d'entree qui marche est "organizations",
        // l'application refuse les comptes personnels : on le dit.
        personnelSeulement: info.tenant === 'organizations',
        expiresIn: info.expiresIn
      };
    },

    cancel() {
      if (session.login && session.login.timer) clearInterval(session.login.timer);
      session.login = null;
      session.login_clientId = null;
      return true;
    },

    /*  Echange du device_code contre les jetons Microsoft.
        Un device_code ne sert qu'une fois : si deux appels arrivent en
        meme temps, le second se fait refuser avec AADSTS70000 alors que
        la connexion a reussi. On serialise donc les interrogations.     */
    async poll() {
      if (!session.login) throw new Error('Aucune connexion en cours');
      if (session.polling) { await session.polling; return { done: false }; }

      session.polling = (async () => {
        const r = await auth.pollDeviceCode(
          cfgm.load().workingClientId || cfgm.clientId(),
          session.login.deviceCode,
          session.login.interval,
          session.login.tenant
        );
        if (r.slowDown && session.login) session.login.interval = Math.min(20, session.login.interval + 5);
        if (r.done) XRN.report('AUTH', 'jeton obtenu, echange XBL/XSTS en cours');
        return r;
      })();

      try { return await session.polling; }
      catch (e) {
        XRN.report('AUTH', 'poll refuse : ' + ((e && (e.code + ' / ' + e.message)) || String(e)).slice(0, 300));
        throw e;
      }
      finally { session.polling = null; }
    },

    async finish(tokens) {
      if (!tokens) throw new Error('Aucun jeton recu');
      return completeLogin(tokens);
    },

    current() { return session.account ? auth.publicAccount(session.account) : null; }
  },

  /* ---------------------------------------------------------------- */
  game: {
    async manifest(force) {
      const m = await game.getManifest(force);
      return {
        latest: m.latest,
        versions: m.versions.map(v => ({
          id: v.id, type: v.type, url: v.url, releaseTime: v.releaseTime
        }))
      };
    },
    installed() { return game.installedVersions(); },
    isInstalled(id) { return game.isInstalled(id); },
    install(versionEntry, tokenId) {
      const token = registry.token(tokenId);
      return game.install(versionEntry, { bus, token }).then(async res => {
        registry.drop(tokenId);
        return Object.assign(res, { installed: game.installedVersions() });
      }).catch(e => {
        registry.drop(tokenId);
        if (e.cancelled) return { cancelled: true };
        throw e;
      });
    },
    cancelInstall(tokenId) { const t = registry.token(tokenId); if (t) { t.cancelled = true; t._waiters.forEach(w => w()); } return true; },
    pauseInstall(tokenId, paused) { const t = registry.token(tokenId); if (t) t.paused = !!paused; return true; },

    java() { return game.findJava(0); },
    javaFor(major) { return game.findJava(major); },
    adoptiumUrl(major) { return game.downloadUrlAdoptium(major); },

    /*  Installation de Java dans l'espace de l'application : aucune
        inscription, aucun droit administrateur. Le chemin est memorise
        dans la configuration, le launcher l'utilisera ensuite.        */
    async installJava(major) {
      const r = await game.installJava(major || 17, bus);
      cfgm.save({ javaPath: r.path });
      return r;
    },
    javaDir() { return game.javaDir(); },

    async launch(opts) {
      const acc = session.account;
      const offline = opts.offline;
      if (!offline && !acc) throw new Error('Aucun compte connecte');
      const manifest = util.readJSON(path.join(util.appRoot(), 'cache', 'manifest.json'), null);
      let entry = { id: opts.version, url: null };
      if (manifest && manifest.data && manifest.data.versions) {
        const found = manifest.data.versions.find(v => v.id === opts.version);
        if (found) entry = { id: found.id, url: found.url };
      }
      let accessToken = '0';
      let uuid = acc ? acc.id : (opts.uuid || '00000000000000000000000000000000');
      let username = acc ? acc.name : (opts.username || 'Joueur');
      let userType = acc ? (acc.userType || 'msla') : 'legacy';

      if (acc && acc.refreshToken && !offline) {
        // on tente un rafraichissement si le jeton est vieux
        try {
          if (Date.now() - (acc.savedAt || 0) > 60 * 60 * 1000) {
            const t = await auth.refresh(acc.refreshToken);
            const mcTok = await auth.toMinecraft(t.access_token);
            const prof = await auth.profile(mcTok);
            updateAccount({ ...acc, refreshToken: t.refresh_token, mcToken: mcTok, name: prof.name, id: prof.id, skinUrl: prof.skinUrl, savedAt: Date.now() });
            accessToken = mcTok;
          } else {
            accessToken = acc.mcToken;
          }
        } catch (e) {
          accessToken = acc.mcToken || '0';
        }
      }

      /*  Un compte authlib-injector a besoin de l'agent Java ; sans lui
          le jeu refuse de démarrer car le jeton est inconnu de Mojang. */
      let extraJavaArgs = opts.extraJavaArgs || '';
      if (acc && acc.type === 'authlib') {
        try {
          extraJavaArgs = (extraJavaArgs + ' ' + alib.javaAgentArg(acc)).trim();
        } catch (e) {
          throw e;
        }
      }

      const res = await game.launch({
        version: entry.id,
        versionUrl: entry.url,
        username, uuid, accessToken, userType,
        ramGB: opts.ramGB,
        world: opts.world || null,
        extraJavaArgs
      }, bus);
      session.game = res;
      cfgm.save({ lastVersion: entry.id, lastProfile: username });
      return res;
    },

    running() { return session.game ? { ...session.game, running: isAlive(session.game.pid) } : null; },
    kill() { if (session.game) game.killGame(session.game.pid); session.game = null; return true; }
  },

  /* ---------------------------------------------------------------- */
  /*  Mods et mod loaders                                              */
  /* ---------------------------------------------------------------- */
  mods: {
    etat() { return mods.etat(); },
    list() { return mods.list(); },
    /*  Chemins absolus des fichiers deposes. L'UI les obtient de
        l'objet File de NW.js, qui expose « path ».                   */
    add(chemins) { return mods.add(chemins || []); },
    remove(nom) { return mods.remove(nom); },
    openFolder() { return mods.openFolder(); },
    loaders(versionId) { return mods.loadersDe(versionId); },
    async fabricInfo(mcVersion) { return mods.fabricInstallateur(mcVersion); },
    async installFabric(mcVersion) { return mods.installFabric(mcVersion, bus); },
    async installNeoForge(mcVersion) { return mods.installNeoForge(mcVersion, bus); }
  },

  /* ---------------------------------------------------------------- */
  files: {
    saves() { return files.listSaves(); },
    saveSize(folder) { return files.saveSize(folder); },
    iconPath(folder) { return files.previewIcon(folder); },
    deleteSave(f) { return files.deleteSave(f); },
    renameSave(f, n) { return files.renameSave(f, n); },
    backupSave(f) { return files.backupSave(f); },
    backups() { return files.listBackups(); },
    importSave(archivePath, name) { return files.importSave(archivePath, name); },
    browse(dir, depth) { return files.browse(dir, depth); },
    disk() { return files.diskInfo(); },
    remove(p) { return files.deleteEntry(p); },
    mkdir(p, n) { return files.createFolder(p, n); },
    quick() { return files.quickFolders(); }
  },

  /* ---------------------------------------------------------------- */
  servers: {
    list() { return servers.loadServers(); },
    add(host, port, name) { return servers.addServer(host, port, name); },
    remove(host, port) { return servers.removeServer(host, port); },
    status(host, port) { return servers.status(host, Number(port) || 25565); }
  },

  /* ---------------------------------------------------------------- */
  window: {
    minimize() { const w = nwWindow(); if (w) { w.minimize(); return true; } return false; },
    maximize() {
      const w = nwWindow();
      if (!w) return false;
      if (w.windowState === 'maximized') w.unmaximize(); else w.maximize();
      return true;
    },
    close() { const w = nwWindow(); if (w) { w.close(); return true; } return false; }
  }
};

/* ------------------------------------------------------------------ */
/*  Registre de jetons d'annulation                                    */
/* ------------------------------------------------------------------ */
const registry = {
  map: new Map(), n: 0,
  create() { const t = http.makeToken(); const id = 'tok' + (++this.n); this.map.set(id, t); return id; },
  token(id) { return this.map.get(id) || null; },
  drop(id) { this.map.delete(id); }
};
XRN.game.newToken = () => registry.create();

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
}

/* ------------------------------------------------------------------ */
/*  Finalisation de la connexion Microsoft                              */
/* ------------------------------------------------------------------ */
async function completeLogin(tokens) {
  XRN.report('AUTH', 'finalisation : echange Xbox Live');
  let mcToken;
  try {
    mcToken = await auth.toMinecraft(tokens.access_token);
  } catch (e) {
    XRN.report('AUTH', 'ECHEC XBL/XSTS : ' + ((e && (e.code + ' / ' + e.message)) || String(e)).slice(0, 300));
    throw e;
  }
  XRN.report('AUTH', 'jeton Minecraft obtenu');
  const prof    = await auth.profile(mcToken);
  XRN.report('AUTH', 'profil = ' + prof.name + ' / ' + prof.id);
  const ent     = await auth.entitlements(mcToken);
  XRN.report('AUTH', 'droits sur le jeu : ' + (ent.ownsGame ? 'oui' : 'NON'));
  const account = {
    type: 'microsoft',
    name: prof.name,
    id: prof.id,
    uuid: prof.id,
    skinUrl: prof.skinUrl,
    capeUrl: prof.capeUrl,
    userType: 'msla',
    ownsGame: ent.ownsGame,
    refreshToken: tokens.refresh_token || null,
    mcToken,
    savedAt: Date.now()
  };
  updateAccount(account);
  session.account = account;
  session.login_clientId = session.login ? session.login.clientId : session.login_clientId;
  session.login = null;
  // on ne retient l'identifiant qu'apres une connexion completee :
  // un device code accepte ne prouve rien (le consentement peut echouer).
  if (session.login_clientId) cfgm.save({ workingClientId: session.login_clientId });
  cfgm.save({ lastProfile: account.name });
  bus.emit('auth:connected', auth.publicAccount(account));
  return { account: auth.publicAccount(account), ownsGame: ent.ownsGame };
}

/* ---------- Enregistrement d'un profil authlib-injector ---------- */
function saveAuthlibAccount(p, source) {
  const account = {
    type: 'authlib',
    source: source || 'token',
    name: p.name,
    id: p.uuid || p.id,
    uuid: p.uuid || p.id,
    userType: p.userType || 'msa',
    skinUrl: p.skinUrl || '',
    capeUrl: '',
    accessToken: p.accessToken,
    clientToken: p.clientToken || 'xrnlauncher',
    refreshToken: p.refreshToken || '',
    selectedProfile: p.selectedProfile || null,
    ownsGame: true,
    savedAt: Date.now()
  };
  updateAccount(account);
  session.account = account;
  cfgm.save({ lastProfile: account.name });
  bus.emit('auth:connected', auth.publicAccount(account));
  return auth.publicAccount(account);
}

/* Renouvelle un profil authlib-injector avant qu'il ne meure. */
async function refreshAuthlib(acc) {
  if (!acc.refreshToken) return acc;
  const fresh = await alib.refresh(acc);
  const upd = Object.assign({}, acc, fresh, { savedAt: Date.now() });
  updateAccount(upd);
  session.account = upd;
  return upd;
}

function updateAccount(patch) {
  const db = auth.load();
  const i = db.accounts.findIndex(a => a.id === patch.id);
  if (i >= 0) db.accounts[i] = Object.assign({}, db.accounts[i], patch);
  else db.accounts.push(patch);
  auth.persist(db);
  if (session.account && session.account.id === patch.id) session.account = Object.assign({}, session.account, patch);
}

XRN.auth._complete = completeLogin;

/* Comptes "solo local" (hors-ligne) --------------------------------- */
XRN.auth.addOffline = function (name) {
  const c = cfgm.load();
  const clean = String(name || '').trim().slice(0, 16);
  if (!clean) throw new Error('Pseudo invalide');
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + clean).digest('hex');
  const uuid = [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20)].join('-');
  const account = {
    type: 'offline', name: clean, id: uuid, uuid, skinUrl: '', capeUrl: '',
    userType: 'legacy', savedAt: Date.now()
  };
  updateAccount(account);
  session.account = account;
  bus.emit('auth:connected', auth.publicAccount(account));
  return auth.publicAccount(account);
};

XRN.auth.selectOffline = function (id) {
  const acc = auth.load().accounts.find(a => a.id === id);
  if (!acc) throw new Error('Compte introuvable');
  session.account = acc;
  bus.emit('auth:connected', auth.publicAccount(acc));
  return auth.publicAccount(acc);
};

XRN.auth.selectMicrosoft = function (id) {
  const acc = auth.load().accounts.find(a => a.id === id);
  if (!acc) throw new Error('Compte introuvable');
  session.account = acc;
  bus.emit('auth:connected', auth.publicAccount(acc));
  return auth.publicAccount(acc);
};

XRN.auth.disconnect = function () {
  session.account = null;
  bus.emit('auth:disconnected');
  return true;
};

/* ------------------------------------------------------------------ *
 *  Reprise de session au demarrage
 *
 *  - profil solo      : restaure tel quel
 *  - profil Microsoft : au-dela de N jours d'inactivite on redemande
 *                       une connexion ; sinon on renouvelle le jeton en
 *                       arriere-plan et on met le menu a jour (nom,
 *                       UUID, skin).
 * ------------------------------------------------------------------ */
async function resumeSession() {
  const db = auth.load();
  const last = cfgm.load().lastProfile;
  const acc = db.accounts.find(a => a.name === last) || db.accounts[0] || null;
  session.expired = null;

  if (!acc) { bus.emit('auth:ended', { reason: 'none' }); return null; }

  session.account = acc;

  if (acc.type === 'offline') {
    const pub = auth.publicAccount(acc);
    bus.emit('auth:connected', pub);
    return pub;
  }

  /* --- authlib-injector : c'est le serveur du joueur qui gerait le
         rafraichissement, on lui demande un nouveau jeton. --- */
  if (acc.type === 'authlib') {
    const age = Date.now() - (acc.savedAt || 0);
    if (age > jours * 86400000) {
      session.account = null;
      session.expired = { name: acc.name, reason: 'inactivite', days: jours };
      bus.emit('auth:ended', { reason: 'expired', name: acc.name, days: jours });
      return null;
    }
    session.resuming = true;
    bus.emit('auth:resuming', { name: acc.name });
    try {
      const fresh = await refreshAuthlib(acc);
      const pub = auth.publicAccount(fresh);
      bus.emit('auth:connected', pub);
      return pub;
    } catch (e) {
      /* pas de rafraichissement : on garde la session telle quelle,
         Minecraft refusera plus tard si le jeton est perime.           */
      const pub = auth.publicAccount(acc);
      bus.emit('auth:connected', pub);
      return pub;
    } finally {
      session.resuming = false;
    }
  }

  const jours = cfgm.sessionMaxDays();
  const age = Date.now() - (acc.savedAt || 0);

  if (age > jours * 86400000) {
    session.account = null;
    session.expired = { name: acc.name, reason: 'inactivite', days: jours };
    bus.emit('auth:ended', { reason: 'expired', name: acc.name, days: jours });
    return null;
  }

  session.resuming = true;
  bus.emit('auth:resuming', { name: acc.name });
  try {
    if (!acc.refreshToken) throw new Error('Aucun jeton de rafraichissement enregistre.');
    const t = await auth.refresh(acc.refreshToken);
    const mcTok = await auth.toMinecraft(t.access_token);
    const prof = await auth.profile(mcTok);
    const ent = await auth.entitlements(mcTok);
    const fresh = Object.assign({}, acc, {
      refreshToken: t.refresh_token || acc.refreshToken,
      mcToken: mcTok,
      name: prof.name,
      id: prof.id,
      uuid: prof.id,
      skinUrl: prof.skinUrl,
      capeUrl: prof.capeUrl,
      ownsGame: ent.ownsGame,
      savedAt: Date.now()
    });
    updateAccount(fresh);
    session.account = fresh;
    cfgm.save({ lastProfile: fresh.name });
    const pub = auth.publicAccount(fresh);
    bus.emit('auth:connected', pub);
    return pub;
  } catch (e) {
    session.account = null;
    session.expired = { name: acc.name, reason: 'jeton', error: String((e && e.message) || e).slice(0, 180) };
    bus.emit('auth:ended', { reason: 'expired', name: acc.name, error: session.expired.error });
    return null;
  } finally {
    session.resuming = false;
  }
}

XRN.auth.resume = resumeSession;
XRN.auth.resuming = () => session.resuming;
XRN.auth.expired = () => session.expired;

/* Rafraichit un profil a la volee (bouton de la barre laterale). */
XRN.auth.revalidate = async function () {
  const acc = session.account;
  if (!acc || acc.type !== 'microsoft' || !acc.refreshToken) return acc ? auth.publicAccount(acc) : null;
  try {
    const t = await auth.refresh(acc.refreshToken);
    const mcTok = await auth.toMinecraft(t.access_token);
    const prof = await auth.profile(mcTok);
    const fresh = Object.assign({}, acc, {
      refreshToken: t.refresh_token || acc.refreshToken, mcToken: mcTok,
      name: prof.name, id: prof.id, uuid: prof.id,
      skinUrl: prof.skinUrl, capeUrl: prof.capeUrl, savedAt: Date.now()
    });
    updateAccount(fresh);
    session.account = fresh;
    const pub = auth.publicAccount(fresh);
    bus.emit('auth:connected', pub);
    return pub;
  } catch (e) {
    return acc ? auth.publicAccount(acc) : null;
  }
};

/* ------------------------------------------------------------------ */
/*  Exposition                                                         */
/* ------------------------------------------------------------------ */
/* Journal de demarrage : preuve que le contexte Node est bien charge ---- */
try {
  const logDir = path.join(util.appRoot(), 'logs');
  util.ensureDir(logDir);
  fs.appendFileSync(path.join(logDir, 'launcher.log'),
    new Date().toISOString() + '  XRNLauncher v' + pkg.version +
    '  |  node ' + process.versions.node +
    '  |  appData ' + util.appRoot() +
    '  |  gameDir ' + cfgm.load().gameDir + '\n', 'utf8');
} catch (e) {}

/* Acces securise a la fenetre NW.js : indisponible depuis le contexte Node
   de fond sur NW.js recent -> on renvoie null, l'interface bascule sur window.nw */
function nwWindow() {
  try {
    const mod = require('nw.Window');
    return mod && mod.get ? (mod.get() || null) : null;
  } catch (e) { return null; }
}

window.XRN = XRN;
if (typeof module !== 'undefined') module.exports = XRN;

/* Journal accessible depuis l'interface ---------------------------------- */
XRN.report = function (kind, msg) { writeLog(kind || 'UI', msg); };

/* Icone de la fenetre / barre des taches : le .exe porte celle de NW.js,
   on la remplace a l'execution par le logo XRN.                          */
(function applyWindowIcon() {
  const candidates = ['assets/icon.png', 'assets/icon.ico'].map(p => path.join(appDir(), p));
  const icon = candidates.find(p => util.exists(p));
  if (!icon) { writeLog('ICONE', 'introuvable : ' + candidates.join(', ')); return; }
  try {
    const win = nwWindow();
    if (!win || typeof win.setIcon !== 'function') { writeLog('ICONE', 'setIcon indisponible'); return; }
    win.setIcon(icon);
    writeLog('ICONE', 'appliquee : ' + icon);
  } catch (e) {
    writeLog('ICONE', 'echec : ' + e.message);
  }
})();

function writeLog(kind, msg) {
  try {
    const d = path.join(util.appRoot(), 'logs');
    util.ensureDir(d);
    fs.appendFileSync(path.join(d, 'launcher.log'),
      new Date().toISOString() + '  [' + kind + '] ' + String(msg).replace(/\s+/g, ' ').slice(0, 900) + '\n', 'utf8');
  } catch (e) { /* disque indisponible */ }
}

process.on('uncaughtException', e => {
  writeLog('FATAL', (e && (e.stack || e.message)) || String(e));
  try { bus.emit('app:error', { message: e.message, stack: e.stack }); } catch (x) {}
});
process.on('unhandledRejection', e => {
  writeLog('REJET', (e && (e.stack || e.message)) || String(e));
});
process.on('exit', code => writeLog('EXIT', 'code=' + code));