if (typeof require === 'function') {
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
const microsoftSession = require('./lib/microsoft-session').create(auth, account => updateAccount(account));
const game   = require('./lib/game');
const files  = require('./lib/files');
const screenshots = require('./lib/screenshots');
const servers = require('./lib/servers');
const alib   = require('./lib/authlib');
const mods   = require('./lib/mods');
const catalog = require('./lib/mod-catalog');
const skins  = require('./lib/skins');
const notif  = require('./lib/notification');
const media  = require('./lib/media');
const manif  = require('./lib/manifeste');
const communaute = require('./lib/communaute');
const presence = require('./lib/presence');
const boutique = require('./lib/boutique');
const cosmetics = require('./lib/cosmetics');
require('./lib/private-relay').start().catch(()=>{});

util.ensureDir(util.appRoot());

// Repertoire de l'application : __dirname n'existe pas dans tous les contextes NW.js
function appDir() {
  try { if (typeof __dirname === 'string' && __dirname) return __dirname; } catch (e) {}
  try { if (typeof process !== 'undefined' && process.cwd()) return process.cwd(); } catch (e) {}
  return '.';
}
const pkg = util.readJSON(path.join(appDir(), 'package.json'), { version: '0.0.0' });

/*  L etat de la mise a jour : un seul telechargement a la fois.
    Le jeton sert a annuler, le drapeau a refuser un second
    demarrage pendant que le premier tourne.                     */
let majEnCours = false;
let jetonMaj = null;

/*  Dossier d'installation de l'application (la ou sont poses les
    fichiers du launcher). C'est distinct du dossier de donnees
    utilisateur (%APPDATA%\XRNLauncher) : une installation et ses
    reglages ne bougent pas ensemble.                                */
function dossierInstall() {
  return manif.dossierInstall();
}

/*  Le pseudo du joueur connecte, ou une chaine vide. C'est la seule
    information envoyee au service : un pseudo de jeu, rien d autre.  */
function pseudoSession() {
  try {
    return (session.account && session.account.name) ? String(session.account.name) : '';
  } catch (e) { return ''; }
}
const bus = new EventEmitter();
bus.setMaxListeners(64);
bus.on('game:exit',()=>{session.game=null;presence.afterGameExit();});

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
    cosmetics: {
      gift(action,body){if(!['redeem','create','list','revoke'].includes(action))throw Error('Action inconnue.');return cosmetics.gift(session.account,action,body);},
      gift(action,body){if(!['redeem','create','list','revoke'].includes(action))throw Error('Action inconnue.');return cosmetics.gift(session.account,action,body);},
      async checkout(id){const r=await cosmetics.checkout(session.account,id);nw.Shell.openExternal(r.url);return {order:r.order,test:r.test};},
      paymentStatus(order){return cosmetics.paymentStatus(session.account,order);},
      orders(){return cosmetics.orders(session.account);},
      skin(){return cosmetics.skin(session.account);},
      async catalogue(){await require('./lib/private-relay').start().catch(()=>{});await presence.sync(session.account).catch(()=>{});return cosmetics.catalogue(session.account);},
      equip(id){return cosmetics.equip(session.account,id);},
      status(){return presence.status();},
      async refresh(){await require('./lib/private-relay').start().catch(()=>{});await presence.sync(session.account);return cosmetics.catalogue(session.account);}
    },
    shippedClientId() { return cfgm.shipped().microsoftClientId || ''; },

    /*  La communaute : l'annuaire des pseudos qui utilisent le client.
        Le launcher s'y inscrit, et recupere la liste, pour que le mod
        puisse mettre le logo a cote de leur pseudo.                      */
    communaute: {
      liste() { return communaute.listeLocale(); },
      async rafraichir() {
        const r = await communaute.rafraichir(pseudoSession());
        if (r.ok) XRN.report('COMMUNAUTE', r.total + ' pseudo(s) a l annuaire');
        return r;
      },
      ajouter(pseudos) { return communaute.ajouter(pseudos); },
      /*  Ce que le joueur porte : le mod l a enregistre, dans les
          reglages du jeu. C'est ce que le launcher publie.            */
      cosmetique() { return communaute.cosmetiquePorte(); }
    },

    /*  La boutique : le catalogue, les droits, l'activation d'un code,
        et la recompense quotidienne.                                     */
    boutique: {
      async catalogue() { return boutique.catalogue(pseudoSession()); },
      async activer(code) {
        const r = await boutique.activer(pseudoSession(), code);
        if (r.ok) XRN.report('BOUTIQUE', 'droit obtenu : ' + r.produit);
        return r;
      },
      async recompense() {
        const r = await boutique.recompense(pseudoSession());
        if (r && r.ok && r.gagne) XRN.report('BOUTIQUE', 'recompense du jour : +' + r.gagne + ' etoiles');
        return r;
      },
      droits() { return boutique.droitsLocaux(); }
    },
    saveConfig(patch) {
      const c = cfgm.save(patch);
      /*  Une trace par enregistrement : on voit dans le journal ce qui
          a ete ecrit, et quand. Sans cela, un reglage qui ne seemingly
          part pas reste impossible a diagnostiquer.                      */
      writeLog('CFG', 'enregistre : ' + Object.keys(patch || {}).join(', '));
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
    /*  Mise a jour appliquee seule : on cherche la derniere version,
        puis on prend le patch si l installation locale s y prete. C est
        ce que fait la notification quand elle annonce une version.   */
    async appliquerMiseAJourAuto() {
      const r = await this.chercherMiseAJour();
      if (!r || !r.ok) return { ok: false, detail: 'aucune mise a jour' };
      const url = r.mode === 'patch' ? r.patch : r.mode === 'noyau' ? r.noyau : (r.telecharger || r.url);
      if (!url) return { ok: false, detail: 'adresse introuvable' };
      return this.appliquerMiseAJour(url, r.taille, r.mode);
    },

    async appliquerMiseAJour(url, total, mode) {
      try {
        if (!url) return { ok: false, detail: 'aucune adresse' };
        const release=await http.getJSON('https://api.github.com/repos/xerion-xerion-xerion/XRNLauncher/releases/latest');
        const approved=require('./lib/release-security').approvedAsset(url,release.assets);
        total=approved.size;
        /*  Une seule mise a jour a la fois : deux clics rapides sur
            deux boutons lancaient deux telechargements complets en
            parallele (vrai dans le journal). On refuse le second.    */
        if (majEnCours) return { ok: false, detail: 'mise a jour deja en cours' };
        majEnCours = true;
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
          await http.download(approved.url, zip, { token: jetonMaj,sha256:approved.sha256,verify:true });
        } finally {
          clearInterval(suivi);
        }
        bus.emit('maj:progression', { recues: total || 0, total: total || 0, fini: true });

        const dossierApp = path.dirname(process.execPath);
        const script = path.join(dossierApp, 'tools', 'appliquer-maj.ps1');
        if (!util.exists(script)) return { ok: false, detail: 'script de mise a jour introuvable' };
        const exe = path.join(dossierApp, 'XRNLauncher.exe');

        /*  Le script doit survivre a la fermeture de l application :
            tout enfant du launcher est arrete avec lui (job object),
            et le script mourait donc avant d appliquer quoi que ce
            soit. On passe par l explorateur : il demarre le script
            depuis le shell, hors de notre arbre de processus.

            On ecrit donc un petit .vbs, et c est l explorateur qui
            le lance : le script demarre ainsi hors de notre arbre de
            processus, et survit a la fermeture de l application.    */
        const fichierVbs = path.join(require('os').tmpdir(), 'xrn-maj-' + Date.now() + '.vbs');
        const cheminPs = path.join(process.env.SystemRoot || 'C:\\Windows',
          'System32\\WindowsPowerShell\\v1.0\\powershell.exe');
        const commande = '& "' + cheminPs + '"'
          + ' -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass'
          + ' -File "' + script + '"'
          + ' -IdLauncher ' + process.pid
          + ' -Mode ' + (mode === 'complet' ? 'complet' : 'patch')
          + ' -Zip "' + zip + '"'
          + ' -Dossier "' + dossierApp + '"'
          + ' -Exe "' + exe + '"';
        /*  La commande est passee en base64 : un .vbs est lu dans
            l encodage systeme, et un chemin accentue y serait abime.
            Le .vbs evite aussi toute fenetre console a l ecran.   */
        const encode = Buffer.from(commande, 'utf16le').toString('base64');
        fs.writeFileSync(fichierVbs,
          'CreateObject("WScript.Shell").Run "powershell -NoProfile -EncodedCommand '
          + encode + '", 0, False\r\n', 'ascii');

        const child = spawn('explorer.exe', [fichierVbs], { stdio: 'ignore', windowsHide: true });
        child.unref();
        XRN.report('MAJ', 'mise a jour programmee (' + (mode || 'complet') + '), fichier=' + fichierVbs);

        /*  On ne ferme que si le script a reellement demarre : sinon
            on resterait sans launcher et sans mise a jour.         */
        const journal = path.join(util.appRoot(), 'logs', 'maj.log');
        setTimeout(() => {
          let demarre = false;
          try {
            const t = fs.statSync(journal).mtimeMs;
            demarre = (Date.now() - t) < 30000;
          } catch (e) { demarre = false; }
          if (!demarre) {
            majEnCours = false;
            XRN.report('MAJ-ERREUR', 'le script de mise a jour n a pas demarre, le launcher reste ouvert');
            return;
          }
          try { XRN.close(); } catch (e) { }
          setTimeout(() => { try { process.exit(0); } catch (e) { } }, 800);
        }, 4000);
        return { ok: true };
      } catch (e) {
        majEnCours = false;
        XRN.report('MAJ-ERREUR', String(e && e.message ? e.message : e));
        return { ok: false, detail: String(e && e.message ? e.message : e) };
      }
    },

    /*  Annule le telechargement en cours. */
    annulerMaj() {
      try { if (jetonMaj) jetonMaj.cancelled = true; } catch (e) { }
      return { ok: true };
    },

    installationId() { return notif.idInstallation(); },
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

    /*  Empreinte SHA-256 d'un fichier : c'est le module manifeste qui
        s en charge, il sait aussi lire la version du runtime.        */
    sha256Fichier(f) { return manif.sha256Fichier(f); },

    /*  Version du runtime NW.js installe. */
    versionRuntime() { return manif.versionRuntime(dossierInstall()); },

    /*  Le manifeste de l'installation locale : il dit ce que le
        launcher a reellement sur le disque. Il ne sert qu'au
        diagnostic : la compatibilite du patch se verifie sur les
        fichiers eux-memes, pour que les installations anterieures a
        cette notion restent compatibles.                                 */
    manifesteLocal() { return manif.manifesteLocal(dossierInstall()); },

    /*  Le patch est-il applicable a cette installation ?

        Le manifeste publie contient "precedents" : l'etat de la
        version installee, fichier par fichier, avec les empreintes. Si
        le disque correspond exactement, et que le runtime n'a pas
        change, on ne telecharge que les fichiers modifies. Sinon on
        reprend l'archive complete : mieux vaut retelecharger que
        laisser un melange de deux versions.                              */
    etatLocalCompatible(m) {
      const r = manif.etatLocalCompatible(m, dossierInstall());
      if (!r.ok) writeLog('MAJ', 'patch refuse : ' + r.raison);
      return r.ok;
    },

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
        let patch = '';
        let noyau = '';
        let manifesteUrl = '';
        let taille = 0;
        let taillePatch = 0;
        let tailleNoyau = 0;
        for (const a of assets) {
          if (!a || !a.name || !a.browser_download_url) continue;
          const nom = String(a.name);
          if (/^XRNLauncher-win-x64\.zip$/i.test(nom)) {
            telecharger = String(a.browser_download_url);
            taille = Number(a.size) || 0;
          } else if (/^XRNLauncher-patch\.zip$/i.test(nom)) {
            patch = String(a.browser_download_url);
            taillePatch = Number(a.size) || 0;
          } else if (/^XRNLauncher-noyau\.zip$/i.test(nom)) {
            noyau = String(a.browser_download_url);
            tailleNoyau = Number(a.size) || 0;
          } else if (/^XRNLauncher-manifest\.json$/i.test(nom)) {
            manifesteUrl = String(a.browser_download_url);
          }
        }
        /*  Le manifeste dit ce que l on peut reutiliser :
            1. le patch, quand l installation correspond exactement a
               la version precedente publiee ;
            2. sinon le noyau, quand seul le runtime est inutile a
               retelecharger (version sautee, fichier modifie chez un
               joueur) : quelques Mo, pas 180 ;
            3. sinon l installation complete, quand le runtime a
               change.                                                   */
        let mode = 'complet';
        if (patch && manifesteUrl) {
          try {
            const m = await http.getJSON(manifesteUrl);
            if (m && this.etatLocalCompatible(m)) {
              mode = 'patch';
              taille = taillePatch;
            } else if (noyau && m && m.runtime) {
              const installe = manif.versionRuntime(dossierInstall());
              if (installe && installe === String(m.runtime)) {
                mode = 'noyau';
                taille = tailleNoyau;
              }
            }
          } catch (e) { }
        }
        return { ok: true, version, courant, telecharger, patch, noyau, mode, taille,
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
    diagnostic() { return require('./lib/auth-diagnostic').current(); },
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
      session.loginMode = 'minecraft';
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
      if(session.login?.sisuWindow)session.login.sisuWindow.cancel();
      const sisu=require('./lib/auth-sisu');
      const flow=await sisu.begin();
      const authWindow=require('./lib/auth-window').open(nw,flow,sisu);
      session.login={mode:'minecraft',clientId:sisu.CLIENT_ID,sisuWindow:authWindow,expiresAt:flow.ctx.expiresAt};
      return {provider:sisu.PROVIDER,userCode:'Microsoft',expiresIn:flow.expiresIn};
    },

    cancel() {
      if (session.login && session.login.timer) clearInterval(session.login.timer);
      if(session.login?.sisuWindow)session.login.sisuWindow.cancel();
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
      if(session.login.sisuWindow)return session.login.sisuWindow.poll();
      if (session.polling) { await session.polling; return { done: false }; }

      const attempt = session.login;
      session.polling = (async () => {
        const r = await auth.pollDeviceCode(
          attempt.clientId,
          attempt.deviceCode,
          attempt.interval,
          attempt.tenant
        );
        if (session.login !== attempt) return {done:false};
        if (r.slowDown) attempt.interval = Math.min(20, attempt.interval + 5);
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

    clientBuilds() { return require('./lib/client-builds').manifest().map(b=>({minecraft:b.minecraft,loader:b.loader})); },
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
      let userType = acc ? (acc.userType || 'msa') : 'legacy';

      /*  Un vrai jeton Minecraft, c'est ce qui fait que le jeu tourne
          avec le VRAI compte : skin, session en ligne, et le bon
          identifiant cote serveur. Un jeton a '0' fait tourner le jeu
          hors ligne, avec un faux profil.

          L'echange Xbox -> Minecraft a besoin de la portee de service
          de Minecraft (voir OAUTH_SCOPE). Si elle manque, Mojang
          refuse avec un 403 "Invalid app registration" : on ne casse
          donc pas le lancement, on retombe sur le jeton deja connu. */
      if (acc && ['microsoft','xbox'].includes(acc.type)) {
        const verified = await microsoftSession.validate(acc);
        session.account = verified;
        accessToken = verified.mcToken; uuid = verified.id; username = verified.name; userType = 'msa';
        bus.emit('auth:connected', auth.publicAccount(verified));
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

      const supported=require('./lib/client-builds').manifest().some(b=>b.minecraft===entry.id&&b.loader==='fabric');
      let disabledClient=false;
      try{disabledClient=fs.readdirSync(mods.modsDir()).some(n=>/^xrn-hud-.*\.jar\.disabled$/i.test(n));}catch{}
      if(cfgm.load().clientEnabled!==false&&!disabledClient&&supported&&mods.loadersDe(entry.id).length===0){
        const existing=mods.profilsMod().find(p=>p.base===entry.id&&p.loader.id==='fabric');
        if(existing)entry={id:existing.version,url:null};
        else{bus.emit('mods:stage',{text:'Preparation de XRN Client pour Minecraft '+entry.id+'…'});const profile=await mods.installFabric(entry.id,bus);entry={id:profile.profil,url:null};}
      }
      const pose=mods.installerIntegres(entry.id);
      if(pose.poses.length)XRN.report('MODS',pose.poses.join(', '));
      if(pose.echecs.length)throw new Error(pose.echecs.map(e=>e.nom+' : '+e.raison).join('\n'));
      if(!pose.compatibility.supported)bus.emit('mods:notice',{text:pose.compatibility.reason});

      await presence.beforeGameStart(session.account).catch(()=>XRN.report('PRESENCE','Apparence partagée indisponible ; lancement du jeu maintenu.'));
      let res;
      try { res = await game.launch({
        version: entry.id,
        versionUrl: entry.url,
        username, uuid, accessToken, userType,
        ramGB: opts.ramGB,
        world: opts.world || null,
        extraJavaArgs
      }, bus); } catch(error) { presence.afterGameExit();throw error; }
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
  modCatalog: {contexts:catalog.contexts,search:catalog.search,prepare:catalog.prepare,install:catalog.install},
  mods: {
    etat() { return mods.etat(); },
    list() { return mods.list(); },
    /*  Chemins absolus des fichiers deposes. L'UI les obtient de
        l'objet File de NW.js, qui expose « path ».                   */
    add(chemins) { return mods.add(chemins || []); },
    remove(nom) { return mods.remove(nom); },
    setEnabled(nom, enabled) { return mods.setEnabled(nom, enabled); },
    openFolder() { return mods.openFolder(); },
    loaders(versionId) { return mods.loadersDe(versionId); },
    async fabricInfo(mcVersion) { return mods.fabricInstallateur(mcVersion); },
    async installFabric(mcVersion) { return mods.installFabric(mcVersion, bus); },
    async installNeoForge(mcVersion) { return mods.installNeoForge(mcVersion, bus); }
  },

  /* ---------------------------------------------------------------- */
  screenshots: screenshots,
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
  const mcToken = tokens.authProvider===require('./lib/auth-sisu').PROVIDER ? await require('./lib/auth-sisu').minecraft(tokens) : await auth.toMinecraft(tokens.access_token);
  XRN.report('AUTH', 'jeton Minecraft obtenu');
  const prof    = await auth.profile(mcToken);
  XRN.report('AUTH', 'profil Minecraft confirme');
  const ent     = await auth.entitlements(mcToken);
  XRN.report('AUTH', 'droits sur le jeu : ' + (ent.ownsGame ? 'oui' : 'NON'));
  const account = {
    type: 'microsoft',
    name: prof.name,
    id: prof.id,
    uuid: prof.id,
    skinUrl: prof.skinUrl,
    capeUrl: prof.capeUrl,
    userType: 'msa',
    ownsGame: ent.ownsGame,
    minecraftVerified: true,
    verifiedAt: Date.now(),
    refreshToken: tokens.refresh_token || null,
    authProvider:tokens.authProvider || 'azure-device',
    authClientId:tokens.clientId || session.login?.clientId || cfgm.clientId(),
    mcToken,
    savedAt: Date.now()
  };
  updateAccount(account);
  session.account = account;
  session.login_clientId = session.login ? session.login.clientId : session.login_clientId;
  session.login = null;
  // on ne retient l'identifiant qu'apres une connexion completee :
  // un device code accepte ne prouve rien (le consentement peut echouer).
  if (session.login_clientId && account.authProvider!=='xbox-sisu-pkce') cfgm.save({ workingClientId: session.login_clientId });
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
  let db;
  try { db=auth.load(); }
  catch(error) {
    // A newly authenticated account can recover an unreadable local store.
    // Keep the old file for recovery; never substitute a failed online login.
    const original=auth.store();
    if(fs.existsSync(original))fs.copyFileSync(original,original+'.unreadable.'+Date.now());
    db={accounts:[]};
    XRN.report('AUTH','Ancien fichier de session illisible conservé avant réenregistrement.');
  }
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

XRN.auth.selectMicrosoft = async function (id) {
  const account = auth.load().accounts.find(a => a.id === id);
  const verified = await microsoftSession.validate(account);
  session.account = verified;
  cfgm.save({lastProfile:verified.name});
  bus.emit('auth:connected', auth.publicAccount(verified));
  return auth.publicAccount(verified);
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
  const jours = cfgm.sessionMaxDays();
  const acc = db.accounts.find(a => a.name === last) || db.accounts[0] || null;
  session.expired = null;

  if (!acc) { bus.emit('auth:ended', { reason: 'none' }); return null; }

  session.account = acc;

  if (acc.type === 'offline') {
    const pub = auth.publicAccount(acc);
    bus.emit('auth:connected', pub);
    inscrireCommunaute();
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
      inscrireCommunaute();
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
    const fresh = await microsoftSession.validate(acc);
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

/*  Annuaire de la communaute.

    Au demarrage, le launcher inscrit son pseudo et va chercher la
    liste des joueurs qui utilisent le client. C'est ce qui permet a
    chacun de voir le logo a cote des autres.

    C'est fait en arriere-plan : le lanceur demarre tout de suite, et
    la liste arrive quand elle arrive. Sans reseau, le mod garde la
    liste qu il a deja.                                                 */
function inscrireCommunaute() {
  const account=session.account;
  if (!account || !account.minecraftVerified) return;
  presence.sync(account).catch(() => XRN.report('PRESENCE','Service de présence indisponible ; le jeu reste utilisable.'));
}
const presenceTimer=setInterval(() => {
  presence.sync(session.account).catch(() => {});
},5000);
if (presenceTimer.unref) presenceTimer.unref();

/* Rafraichit un profil a la volee (bouton de la barre laterale). */
XRN.auth.revalidate = async function () {
  const fresh = await microsoftSession.validate(session.account);
  session.account = fresh;
  bus.emit('auth:connected', auth.publicAccount(fresh));
  return auth.publicAccount(fresh);
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
  /*  Le detecteur de musique est un processus a part : on le ferme
  avec le launcher, sinon il continuerait d interroger Windows.     */
  process.on('exit', () => { try { if (session.game) media.detacher(); else media.arreter(); } catch (e) { } });
}
