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
const skins  = require('./lib/skins');
const notif  = require('./lib/notification');

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

/*  Chemin complet de l'image d'un processus, ou null s'il n'existe plus.

    tasklist ne donne que le NOM de l image. Or les deux versions du
    launcher portent le meme nom (XRNLauncher.exe) : c est le chemin
    complet qui permet de les distinguer. On l obtient via PowerShell
    et CIM, demarre une seule fois au lancement, le cout est negate. */
function imageDuProcess(pid) {
  try {
    const r = spawnSync('powershell',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command',
       '(Get-CimInstance Win32_Process -Filter "ProcessId=' + pid + '").ExecutablePath'],
      { encoding: 'utf8', windowsHide: true, timeout: 12000 });
    if (!r || r.status !== 0 || !r.stdout) return null;
    const chemin = r.stdout.split(/\r?\n/).map(function (l) { return l.trim(); })
      .find(function (l) { return l && l.toLowerCase().endsWith('.exe'); });
    return chemin || null;
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
    /*  Le chemin doit designer le meme executable, dossier compris :
        sinon c est une autre installation, pas une autre instance. */
    if (!memeExecutable(img)) return null;
    return pid;
  } catch (e) { return null; }
}

function sansExt(nom) {
  return nom.replace(/\.exe$/, '');
}

/*  Meme executable ? On compare le chemin complet : les deux versions
    du launcher portent le meme nom de fichier, seul le dossier les
    distingue.                                                        */
function memeExecutable(image) {
  try {
    const ici = path.resolve(process.execPath).toLowerCase();
    const la  = path.resolve(image).toLowerCase();
    if (ici === la) return true;
    /*  Chemin different : on tolere seulement une difference
        d extension (l exe peut s appeler .exe ou pas).                */
    return sansExt(ici) === sansExt(la);
  } catch (e) {
    return false;
  }
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
/* -------------------------------------------------------------------- *
 *  Compare deux versions du type "4.2.0". Vrai si b est plus recente
 *  que a. Les parties non numeriques sont ignorees.
 * -------------------------------------------------------------------- */
function plusRecente(a, b) {
  const pa = String(a).split(/[.\-+]/).map(x => parseInt(x, 10) || 0);
  const pb = String(b).split(/[.\-+]/).map(x => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0, vb = pb[i] || 0;
    if (va !== vb) return va > vb;
  }
  return false;
}
const XRN = {
  isDesktop: true,
  version: pkg.version,
  platform: process.platform,
  arch: process.arch,

  /* evenements : XRN.on('dl:progress', fn) */
  on(evt, fn) { bus.on(evt, fn); },
  off(evt, fn) { bus.off(evt, fn); },
  emit(evt, data) { bus.emit(evt, data); },

  
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
    shippedClientId() { return cfgm.shipped().microsoftClientId || ''; },
    saveConfig(patch) {
      const c = cfgm.save(patch);
      /*  Une trace par enregistrement : on voit dans le journal ce qui
          a ete ecrit, et quand. Sans cela, un reglage qui ne seemingly
          part pas reste impossible a diagnostiquer.                      */
      writeLog('CFG', 'enregistre : ' + Object.keys(patch || {}).map(k => k + '=' + c[k]).join(', '));
      return c;
    },
    openFolder(p) { return util.openExplorer(p); },
    selectInExplorer(p) { return util.openExplorer(p, true); },
    openUrl(url) { return util.openUrl(url); },

    /*  Message envoye par l auteur du launcher.

        Il vient d un point d entree chez lui, qui garde au passage la
        liste des installations. C est ce qui lui permet d envoyer
        n importe quelle notification, et pas seulement une mise a
        jour. Si le point d entree est hors ligne, on ne dit rien.  */
    /*  Mise a jour automatique : on telecharge l archive, puis un
        script applique les fichiers une fois le launcher ferme, et le
        relance. Le joueur n a rien a decompresser.                   */
    async appliquerMiseAJour(url, total) {
      try {
        if (!url) return { ok: false, detail: 'aucune adresse' };
        const zip = path.join(require('os').tmpdir(), 'xrn-update-' + Date.now() + '.zip');
        XRN.report('MAJ', 'telechargement de ' + url);

        /*  On suit la taille du fichier qui se remplit : c est la seule
            mesure honnete, le serveur ne dit pas combien il a deja
            envoye.                                                     */
        let taille = 0;
        const suivi = setInterval(() => {
          try { taille = fs.statSync(zip).size; } catch (e) { taille = 0; }
          bus.emit('maj:progression', { recues: taille, total: total || 0 });
        }, 400);

        jetonMaj = require('./lib/http').makeToken();
        try {
          await http.download(url, zip, { token: jetonMaj });
        } finally {
          clearInterval(suivi);
        }
        bus.emit('maj:progression', { recues: total || 0, total: total || 0, fini: true });

        const dossierApp = path.dirname(process.execPath);
        const script = path.join(dossierApp, 'tools', 'appliquer-maj.ps1');
        if (!util.exists(script)) return { ok: false, detail: 'script de mise a jour introuvable' };
        const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-File', script,
          '-IdLauncher', String(process.pid),
          '-Zip', zip,
          '-Dossier', dossierApp,
          '-Exe', path.join(dossierApp, 'XRNLauncher.exe')];
        /*  Pas de "detached" : sur cette version de node, un enfant
            detache ne demarre jamais, et le script ne s'execute donc
            pas. Sans cette option, l enfant herite de la console du
            launcher et survit a sa fermeture.                         */
        const child = spawn('powershell', args, { stdio: 'ignore', windowsHide: true });
        child.unref();
        XRN.report('MAJ', 'mise a jour programmee, pid=' + child.pid);

        /*  Le script arrete le launcher si besoin : l application se
            cache dans le tray et ses fichiers resteraient bloques. */
        try { XRN.close(); } catch (e) { }
        setTimeout(() => { try { process.exit(0); } catch (e) { } }, 1200);
        return { ok: true };
      } catch (e) {
        XRN.report('MAJ-ERREUR', String(e && e.message ? e.message : e));
        return { ok: false, detail: String(e && e.message ? e.message : e) };
      }
    },

    /*  Annule le telechargement en cours. */
    annulerMaj() {
      try { if (jetonMaj) jetonMaj.cancelled = true; } catch (e) { }
      return { ok: true };
    },

    async notification() {
      try {
        const r = await notif.verifier();
        XRN.report('NOTIF', r ? ('message recu : ' + r.id) : 'aucun message');
        return r;
      } catch (e) {
        XRN.report('NOTIF', 'erreur : ' + (e && e.message ? e.message : e));
        return null;
      }
    },
    marquerNotificationVue(id) { notif.marquerVue(id); },

    /*  Cherche si une version plus recente du launcher est publiee.

        L API publique de GitHub suffit : aucune cle, aucune
        authentification, et elle renvoie la release publiee la plus
        recente, celle que les telechargeurs utilisent. Le test est
        silencieux : sans reseau, on ne dit rien du tout.            */
    async chercherMiseAJour() {
      const courant = String((pkg && pkg.version) || '0.0.0');
      try {
        const r = await http.getJSON('https://api.github.com/repos/xerion-xerion-xerion/XRNLauncher/releases/latest');
        const tag = String((r && r.tag_name) || '');
        const version = tag.replace(/^v/i, '');
        if (!version) return { ok: false };
        if (!plusRecente(version, courant)) return { ok: false, version, courant };
        /*  Le lien direct vers le zip, s il est dans les assets : le
            bouton de la notification telecharge alors directement.  */
        const assets = (r && r.assets) || [];
        let telecharger = '';
        let taille = 0;
        for (const a of assets) {
          if (a && a.name && /\.zip$/i.test(a.name) && a.browser_download_url) {
            telecharger = String(a.browser_download_url);
          taille = Number(a.size) || 0;
            break;
          }
        }
        return { ok: true, version, courant, telecharger, taille,
                 url: String((r && r.html_url) || '') };
      } catch (e) {
        return { ok: false, courant };
      }
    },
    revealGameDir() { return util.openExplorer(cfgm.load().gameDir); },

    /*  Resout un sous-dossier connu du dossier du jeu ("saves", "mods",
        "screenshots", "logs"...) et renvoie son chemin.

        Le nom est verifie contre une liste blanche et le resultat est
        confine au dossier du jeu : ce bouton ne peut pas servir a ouvrir
        un emplacement arbitraire. Le dossier est cree s'il manque encore,
        sinon l'explorateur interne afficherait une page vide.

        On ne lance plus l'Explorateur Windows : la fenetre du launcher
        recouvre l'ecran, le dossier s'ouvrait derriere et seemed n'avoir
        produit aucun effet. L'onglet Fichiers du launcher le montre.   */
    dossierJeu(nom) {
      const autorises = {
        saves: 'saves', mods: 'mods', screenshots: 'screenshots',
        logs: 'logs', resourcepacks: 'resourcepacks', shaderpacks: 'shaderpacks',
        config: 'config', backups: 'backups', versions: 'versions',
        assets: 'assets', libraries: 'libraries'
      };
      const sous = autorises[String(nom || '').toLowerCase()];
      if (!sous) throw new Error('Dossier inconnu : ' + nom);
      const base = path.resolve(cfgm.load().gameDir);
      const cible = path.resolve(base, sous);
      if (!cible.toLowerCase().startsWith(base.toLowerCase() + path.sep)) {
        throw new Error('Chemin refuse');
      }
      util.ensureDir(cible);
      return cible;
    },
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

    /*  Enregistre l identifiant d application Azure de l utilisateur.
        Vide : on oublie celui qu il avait choisi et on revient a celui
        livre avec le launcher. C est ce qui permet a une distribution
        publique de ne pas imposer l application de l auteur.        */
    setClientId(id) {
      const propre = String(id || '').trim();
      if (!propre) return cfgm.save({ workingClientId: '' });
      if (!/^[0-9a-fA-F-]{32,36}$/.test(propre)) {
        const e = new Error("Cet identifiant n ressemble pas a un identifiant Azure.");
        e.code = 'bad-client-id';
        throw e;
      }
      return cfgm.save({ workingClientId: propre });
    },

    /*  Identifiant reellement utilise, masque : l affichage doit
        montrer que l application est configuree, pas divulguer la
        cle.                                                            */
    clientIdUsed() {
      const c = cfgm.load();
      const w = String(c.workingClientId || '').trim();
      const s = String((cfgm.shipped && cfgm.shipped().microsoftClientId) || '').trim();
      const u = String(c.microsoftClientId || '').trim();
      const choisi = w || (s && s !== 'YOUR_CLIENT_ID' ? s : u);
      return {
        configure: !!choisi,
        masque: choisi ? choisi.slice(0, 6) + '...' : '',
        personnel: !!w
      };
    },

    /*  "minecraft" : la chaine complete, qui exige l'approbation de
        Mojang. "xbox" : on s'arrete a Xbox Live, sans approbation.  */
    setMode(mode) {
      session.loginMode = (mode === 'xbox') ? 'xbox' : 'minecraft';
      return session.loginMode;
    },
    mode() { return session.loginMode || 'minecraft'; },

    /*  Appele quand Microsoft a verifie l'identite mais refuse de livrer
        le pseudo : on termine la session avec le nom choisi par
        l'utilisateur.                                                  */
    chooseName(name) {
      const p = session.login && session.login.pendingXbox;
      if (!p) {
        const e = new Error('Session Xbox introuvable. Relance la connexion.');
        e.code = 'no-pending';
        throw e;
      }
      return enregistrerXbox(p.xb, p.tokens, name);
    },

    async begin() {
      if (!cfgm.hasClientId()) {
        const e = new Error("Identifiant Microsoft absent : colle-le dans le champ de l'onglet Connexion.");
        e.code = 'no-client-id';
        throw e;
      }
      const info = await auth.startDeviceCode(cfgm.clientId());
      session.login = {
        mode: session.loginMode || 'minecraft',
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
    installed() {
      const list = game.installedVersions();
      /*  On marque les profils de mod loaders : l'utilisateur doit
          lancer le profil du chargeur, pas la version d'origine, sinon
          ses mods sont ignores.                                        */
      for (const v of list) {
        const l = mods.loadersDe(v.id);
        if (l.length) v.loader = { id: l[0].id, nom: l[0].nom };
      }
      return list;
    },
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
      let username = acc ? (acc.javaName || acc.name) : (opts.username || 'Joueur');
      let userType = acc ? (acc.userType || 'msla') : 'legacy';

      /*  Un vrai jeton Minecraft, c'est ce qui fait que le jeu tourne
          avec le VRAI compte : skin, session en ligne, et le bon
          identifiant cote serveur. Un jeton a '0' fait tourner le jeu
          hors ligne, avec un faux profil.

          L'echange Xbox -> Minecraft a besoin de la portee de service
          de Minecraft (voir OAUTH_SCOPE). Si elle manque, Mojang
          refuse avec un 403 "Invalid app registration" : on ne casse
          donc pas le lancement, on retombe sur le jeton deja connu. */
      if (acc && acc.refreshToken && !offline) {
        // on tente un rafraichissement si le jeton est vieux
        try {
          if (acc.mcToken && Date.now() - (acc.savedAt || 0) <= 60 * 60 * 1000) {
            accessToken = acc.mcToken;
          } else {
            const t = await auth.refresh(acc.refreshToken);
            const mcTok = await auth.toMinecraft(t.access_token);
            const prof = await auth.profile(mcTok);
            updateAccount({ ...acc, refreshToken: t.refresh_token, mcToken: mcTok, name: prof.name, id: prof.id, uuid: prof.id, skinUrl: prof.skinUrl, savedAt: Date.now() });
            accessToken = mcTok;
            uuid = prof.id;
            username = prof.name;
            userType = 'msla';
          }
        } catch (e) {
          XRN.report('AUTH', 'jeton Minecraft indisponible : ' + (e && e.message ? e.message : e));
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

      /*  XRN HUD est livre avec le launcher : on le met en place juste
          avant de lancer, pour qu'il soit deja la des la premiere
          partie, et qu'une amelioration du mod ne demande rien au
          joueur. Un mod optionnel ne doit jamais bloquer le jeu. */
      try {
        const pose = mods.installerIntegres();
        if (pose && pose.poses && pose.poses.length) {
          XRN.report('MODS', 'poses : ' + pose.poses.join(', '));
        }
        /*  Un echec ici n'est pas anodin : une ancienne version restee
            dans mods/ ferait refuser le demarrage a Fabric.           */
        for (const e of (pose && pose.echecs) || []) {
          XRN.report('MODS-ERREUR', e.nom + ' : ' + e.raison);
        }
      } catch (e) { }

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

  /*  Skin reellement equipee d'un pseudo. Le profil du jeu ne la
      contient qu'apres un echange passe par Mojang : sans cela, un
      profil solo ou Xbox n'aurait qu'une image generique. On interroge
      donc le profil public du joueur, ce qui marche dans tous les cas.  */
  XRN.skin = {
    parNom: (nom) => skins.parNom(nom),
    vider: () => skins.vider()
  };

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
}

/* ------------------------------------------------------------------ */
/*  Finalisation de la connexion Microsoft                              */
/* ------------------------------------------------------------------ */
/*  Mode "xbox" : on s'arrete a l'authentification Xbox Live, qui ne
    demande aucune approbation de Mojang. Le jeu sera lance en mode
    hors-ligne, sous le vrai gamertag Xbox.                            */
async function completeLoginXbox(tokens) {
  XRN.report('AUTH', 'finalisation : echange Xbox (sans services Minecraft)');

  let xb;
  try {
    xb = await auth.toXbox(tokens.access_token);
  } catch (e) {
    XRN.report('AUTH', 'ECHEC Xbox : ' + ((e && (e.code + ' / ' + e.message)) || String(e)).slice(0, 300));
    throw e;
  }

  XRN.report('AUTH', 'identite Xbox : gamertag=' + (xb.name || '?') + ' xid=' + (xb.xuid || '?'));

  /*  Le gamertag Xbox et le pseudo Java sont deux noms differents pour
      un meme compte. On essaie donc les noms plausibles, en commen
      cant par le gamertag : quand les deux coincident, comme c'est
      souvent le cas, rien n est demande du tout. Pour les autres, on
      passe par le nom deja connu de la machine, puis celui memorise.
      Seul echoue, on demande — et une seule fois.                    */
  const cfg = cfgm.load();
  const comptes = auth.load().accounts;
  const connus = comptes.map(a => a && a.name);

  /*  Nom Java deja verifie pour ce xuid : la seule piste sure.     */
  const verifie = comptes.find(a => a && a.type === 'xbox' &&
      a.xuid && xb.xuid && String(a.xuid) === String(xb.xuid) && a.javaName);

  const candidats = [];
  if (verifie) candidats.push(verifie.javaName);
  candidats.push(xb.name);
  for (const n of connus) candidats.push(n);
  candidats.push(cfg.gameTitle);
  candidats.push(cfg.lastProfile);

  let profil = null;
  try { profil = await skins.resoudre(candidats); } catch (e) {}

  if (profil && verifie && profil.nom !== verifie.javaName) {
    /*  Un nom verifie existe deja pour ce compte : on ne le remplace
        pas par un nom trouve au hasard parmi les profils publics. */
    XRN.report('AUTH', 'nom Java conserve : ' + verifie.javaName +
      ' (le profil ' + profil.nom + ' ne correspond pas a ce compte)');
    return enregistrerProfil(xb, tokens,
      { nom: verifie.javaName, uuid: profil.uuid, skin: profil.skin });
  }

  if (profil) {
    XRN.report('AUTH', 'profil Java trouve : ' + profil.nom + ' (uuid ' + profil.uuid + ')');
    return enregistrerProfil(xb, tokens, profil);
  }

  XRN.report('AUTH', 'aucun profil Java pour ' + candidats.filter(Boolean).join(' / '));
  session.login = session.login || {};
  session.login.pendingXbox = { tokens, xb };
  return { needsName: true, xuid: xb.xuid || '', gamertag: xb.name || '' };
}

/*  Le profil est connu : on enregistre le vrai nom, le vrai UUID et la
    vraie skin. L'UUID transmis au jeu sera recalcule par lui en mode
    hors-ligne (toujours derive du nom), mais il sert a l'affichage et
    a la reconnaissance du profil.                                      */
function enregistrerProfil(xb, tokens, profil) {
  const account = {
    type: 'xbox',
    name: profil.nom,
    id: profil.uuid,
    uuid: profil.uuid,
    skinUrl: profil.skin || '',
    avatarUrl: profil.skin || '',
    capeUrl: '',
    userType: 'legacy',
    ownsGame: false,
    xuid: xb.xuid || '',
    gamertag: xb.name || '',
    /*  Nom Java confirme par Mojang pour ce xuid : c est la seule
        valeur qui designe avec certitude le joueur.              */
    javaName: profil.nom,
    refreshToken: tokens.refresh_token || null,
    savedAt: Date.now()
  };
  updateAccount(account);
  session.account = account;
  session.login = null;
  cfgm.save({ lastProfile: account.name });
  bus.emit('auth:connected', auth.publicAccount(account));
  return { account: auth.publicAccount(account), ownsGame: false, mode: 'xbox' };
}

/*  Construit le profil a partir du nom choisi. L'UUID est derive
    exactement comme Minecraft le fait en mode hors-ligne
    ("OfflinePlayer:" + nom) : c'est indispensable, car sinon le jeu
    recalculerait un UUID different de celui du profil et les sauvegarde
    seraient vues comme appartenant a un autre joueur.                 */
function enregistrerXbox(xb, tokens, nom) {
  const crypto = require('crypto');
  const clean = String(nom || '').trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(clean)) {
    const e = new Error('Le pseudo doit faire 1 a 16 caracteres, lettres, chiffres ou tiret bas.');
    e.code = 'bad-name';
    throw e;
  }
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + clean).digest('hex');
  const uuid = [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20)].join('-');
  const account = {
    type: 'xbox',
    name: clean,
    id: uuid,
    uuid: uuid,
    skinUrl: '',
    avatarUrl: xb.avatarUrl || '',
    capeUrl: '',
    userType: 'legacy',
    ownsGame: false,
    xuid: xb.xuid || '',
    refreshToken: tokens.refresh_token || null,
    savedAt: Date.now()
  };
  XRN.report('AUTH', 'profil Xbox = ' + clean + ' / ' + uuid);
  updateAccount(account);
  session.account = account;
  session.login = null;
  cfgm.save({ lastProfile: account.name });
  bus.emit('auth:connected', auth.publicAccount(account));
  return { account: auth.publicAccount(account), ownsGame: false, mode: 'xbox' };
}

async function completeLogin(tokens) {
  if (session.login && session.login.mode === 'xbox') return completeLoginXbox(tokens);
  XRN.report('AUTH', 'finalisation : echange Xbox Live');
  let mcToken;
  try {
    mcToken = await auth.toMinecraft(tokens.access_token);
  } catch (e) {
    /*  Mojang refuse tant que l'application n'est pas declaree. Ce n'est
        pas un echec de l'utilisateur : on bascule donc tout seul sur la
        voie Xbox, qui verifie l'identite du compte et retrouve le vrai
        profil Java ainsi que la vraie skin. Le jour ou Mojang acceptera
        l'application, ce meme bouton donnera le jeton Minecraft complet
        et les serveurs en ligne, sans rien changer dans l'interface.   */
    const msg = String((e && (e.body || e.message)) || e || '');
    if (/Invalid app registration|AppRegInfo/i.test(msg)) {
      XRN.report('AUTH', 'Mojang refuse l application : repli sur la voie Xbox, sans rien demander');
      return completeLoginXbox(tokens);
    }
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

  /*  Compte connecte par Microsoft mais sans jeton Minecraft : il n'y a
      rien a rafraichir du cote Mojang, puisque c'est justement ce qui
      manque. Le code general appelait pourtant toMinecraft, qui echoue
      toujours — le compte etait donc deconnecte a chaque redemarrage,
      alors que son identite est parfaitement connue.

      On restaure donc le compte tout de suite, puis on reverifie en
      arriere-plan : gamertag, pseudo et skin restent disponibles sans
      authentification Mojang. Si le reseau manque, on garde la session
      telle quelle : une identite deja obtenue ne disparait pas parce
      qu'un serveur a repondu a cote.                               */
  if (acc.type === 'xbox') {
    session.resuming = true;
    bus.emit('auth:resuming', { name: acc.name });
    try {
      const t = await auth.refresh(acc.refreshToken);
      const xb = await auth.toXbox(t.access_token);

      /*  Le nom deja verifie passe avant le gamertag : c est la seule
          piste qui designe avec certitude ce joueur.                */
      const candidats = [];
      if (acc.javaName) candidats.push(acc.javaName);
      candidats.push(xb.name, acc.name);
      const profil = await skins.resoudre(candidats);

      /*  Un nom verifie ne se remplace pas par un nom trouve au hasard
          parmi les profils publics de Mojang.                       */
      const nom = acc.javaName || (profil ? profil.nom : acc.name);
      const uuid = acc.javaName ? acc.uuid : (profil ? profil.uuid : acc.id);
      const skin = acc.javaName ? acc.skinUrl : (profil && profil.skin ? profil.skin : acc.skinUrl);

      const fresh = Object.assign({}, acc, {
        gamertag: xb.name || acc.gamertag || '',
        xuid: xb.xuid || acc.xuid || '',
        name: nom,
        id: uuid,
        uuid: uuid,
        skinUrl: skin,
        avatarUrl: skin,
        refreshToken: t.refresh_token || acc.refreshToken,
        savedAt: Date.now()
      });
      updateAccount(fresh);
      session.account = fresh;
      session.resuming = false;
      const pub = auth.publicAccount(fresh);
      bus.emit('auth:connected', pub);
      return pub;
    } catch (e) {
      session.resuming = false;
      const pub = auth.publicAccount(acc);
      bus.emit('auth:connected', pub);
      return pub;
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