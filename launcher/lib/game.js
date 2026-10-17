'use strict';
/*  lib/game.js — metadonnees Mojang, telechargement des fichiers,
                   detection de Java, lancement du jeu                       */

const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const zlib  = require('zlib');
const { spawn } = require('child_process');

const util   = require('./util');
const cfgm   = require('./config');
const http   = require('./http');

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const OUR_OS       = 'windows';
const OUR_ARCH     = process.arch === 'x86' ? 'x86' : (process.arch === 'arm64' ? 'aarch64' : 'x86_64');
const OUR_OSVER    = os.release();

/* ------------------------------------------------------------------ */
/*  Manifeste des versions                                              */
/* ------------------------------------------------------------------ */
function manifestCache() { return path.join(util.appRoot(), 'cache', 'manifest.json'); }

async function getManifest(force) {
  const cacheFile = manifestCache();
  if (!force) {
    const c = util.readJSON(cacheFile, null);
    if (c && c.fetched && Date.now() - c.fetched < 6 * 3600 * 1000 && c.data && c.data.versions) {
      return c.data;
    }
  }
  const data = await http.getJSON(MANIFEST_URL);
  util.writeJSON(cacheFile, { fetched: Date.now(), data });
  return data;
}

/* ------------------------------------------------------------------ */
/*  Regles de librairies                                               */
/* ------------------------------------------------------------------ */
function matchOs(rule) {
  const o = rule.os;
  if (!o) return true;
  if (o.name && o.name !== OUR_OS) return false;
  if (o.arch && o.arch !== OUR_ARCH) return false;
  if (o.version) { try { if (!new RegExp(o.version).test(OUR_OSVER)) return false; } catch (e) { return false; } }
  return true;
}
function allowRules(rules) {
  if (!rules || !rules.length) return true;
  let allowed = false;
  for (const r of rules) { if (matchOs(r)) allowed = (r.action === 'allow'); }
  return allowed;
}
function mvnToPath(p) { return p.replace(/\\/g, '/'); }

/*  Chemin maven d'une bibliotheque : "groupe:artefact:version" donne
    "groupe/avec/les/slashes/artefact/version/artefact-version.jar".
    Les bibliotheques des profils de mod loaders utilisent ce format
    ancien, avec une URL de base plutot qu'une section "downloads".   */
function mavenPath(name, classifier) {
  const parts = String(name || '').split(':');
  const group = parts[0] || '';
  const artifact = parts[1] || '';
  let version = parts[2] || '';
  const cls = parts[3] || classifier || '';
  let ext = 'jar';
  const at = version.indexOf('@');
  if (at !== -1) { ext = version.slice(at + 1); version = version.slice(0, at); }
  let file = artifact + '-' + version;
  if (cls) file += '-' + cls;
  file += '.' + ext;
  return group.replace(/\./g, '/') + '/' + artifact + '/' + version + '/' + file;
}
function baseUrl(u) { return String(u || '').replace(/\/*$/, '/'); }

/* ------------------------------------------------------------------ */
/*  Plan de telechargement                                             */
/* ------------------------------------------------------------------ */
function buildPlan(vjson, cfg, racineId) {
  const dir    = cfg.gameDir;
  const vid    = vjson.id;
  const vdir   = path.join(dir, 'versions', vid);

  /*  Un profil de mod loader (Fabric, NeoForge, Forge) n'a pas son
      propre client : il herite de celui de la version de base, qui
      reste dans son propre dossier.                                */
  const racine    = racineId || vid;
  const dirRacine = path.join(dir, 'versions', racine);
  const jar       = path.join(dirRacine, racine + '.jar');
  const nativesDir = path.join(dirRacine, 'natives');

  const files  = [];
  const natives = [];
  const cp     = [];   // classpath : bibliotheques puis client

  // client
  if (vjson.downloads && vjson.downloads.client) {
    files.push({
      kind: 'client',
      label: 'Client ' + racine,
      url: vjson.downloads.client.url,
      dest: jar,
      sha1: vjson.downloads.client.sha1,
      size: vjson.downloads.client.size
    });
    cp.push(jar);
  }

  // librairies
  for (const lib of (vjson.libraries || [])) {
    if (!allowRules(lib.rules)) continue;
    const dl = lib.downloads || {};
    const name = lib.name.replace(/:/g, '-');
    const base = baseUrl(lib.url);
    const parties = String(lib.name || '').split(':');

    /*  Depuis 1.19, les bibliotheques natives ne sont plus des
        "classifiers" de la bibliotheque principale : ce sont des
        bibliotheques a part entiere dont le nom porte le suffixe
        (par exemple "org.lwjgl:lwjgl:3.3.2:natives-windows"). Leur
        jar contient les DLL, il doit etre extrait et mis de cote :
        le client choisira lui-meme la variante correspondant a son
        architecture parmi les sous-dossiers windows/x64, x86, arm64.  */
    const estNative = parties.length >= 4 && parties[3];
    if (estNative) {
      if (dl.artifact) {
        const dest = path.join(dir, 'libraries', mvnToPath(dl.artifact.path));
        files.push({
          kind: 'natives',
          label: name,
          url: dl.artifact.url,
          dest: dest,
          sha1: dl.artifact.sha1,
          size: dl.artifact.size,
          extractTo: path.join(dirRacine, 'natives')
        });
        natives.push(dest);
      }
      continue;
    }

    if (dl.artifact) {
      const dest = path.join(dir, 'libraries', mvnToPath(dl.artifact.path));
      files.push({
        kind: 'lib',
        label: name,
        url: dl.artifact.url,
        dest: dest,
        sha1: dl.artifact.sha1,
        size: dl.artifact.size
      });
      cp.push(dest);
    } else if (base) {
      /*  Format ancien : { name, url } ou le nom suit la convention
          maven et l'URL est une base de depot. C'est le format utilise
          par les profils Fabric et NeoForge.                          */
      const rel = mvnToPath(mavenPath(lib.name));
      const dest = path.join(dir, 'libraries', rel);
      files.push({
        kind: 'lib',
        label: name,
        url: base + rel,
        dest: dest,
        sha1: null,
        size: 0
      });
      cp.push(dest);
    }

    const cls = dl.classifiers || {};
    for (const key of Object.keys(cls)) {
      if (key.indexOf('natives') !== 0) continue;
      const artifact = cls[key];
      const dest = path.join(dir, 'libraries', mvnToPath(artifact.path));
      files.push({
        kind: 'natives',
        label: name + ' [' + key + ']',
        url: artifact.url,
        dest: dest,
        sha1: artifact.sha1,
        size: artifact.size,
        extractTo: path.join(dirRacine, 'natives')
      });
      natives.push(dest);
    }

    /*  Format ancien : les classes natives sont donnees en chemin
        relatif dans "classifiers".                                      */
    const clsAncien = lib.classifiers || {};
    for (const key of Object.keys(clsAncien)) {
      if (key.indexOf('natives') !== 0) continue;
      const rel = mvnToPath(clsAncien[key]);
      const dest = path.join(dir, 'libraries', rel);
      files.push({
        kind: 'natives',
        label: name + ' [' + key + ']',
        url: base + rel,
        dest: dest,
        sha1: null,
        size: 0,
        extractTo: path.join(dirRacine, 'natives')
      });
      natives.push(dest);
    }
  }

  // index des assets
  let assetIndexId = 'legacy';
  let assetIndexUrl = null;
  if (vjson.assetIndex) {
    assetIndexId = vjson.assetIndex.id;
    assetIndexUrl = vjson.assetIndex.url;
  } else if (vjson.assets) {
    assetIndexId = vjson.assets;
    assetIndexUrl = 'https://s3.amazonaws.com/Minecraft.Download/versions/' + vid + '/' + vid + '.json';
  }

  return {
    id: vid, racine, dir, vdir, files, natives, jar, nativesDir,
    classpath: cp,
    mainClass: vjson.mainClass || 'net.minecraft.client.main.Main',
    arguments: vjson.arguments || null,
    assetsDir: path.join(dir, 'assets'),
    assetIndexId,
    assetIndexUrl,
    mainClass: vjson.mainClass,
    releaseTime: vjson.releaseTime,
    type: vjson.type || 'release',
    javaMajor: vjson.javaVersion && vjson.javaVersion.majorVersion ? vjson.javaVersion.majorVersion : 8,
    clientId: vjson.assetIndex && vjson.assetIndex.id ? vjson.assetIndex.id : assetIndexId
  };
}

/* Analyse l'index des assets et renvoie la liste des objets a telecharger */
async function assetObjects(plan, token, bus) {
  const idxFile = path.join(plan.assetsDir, 'indexes', plan.assetIndexId + '.json');
  let idx = null;
  try { idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')); } catch (e) { idx = null; }
  if (!idx) {
    if (!plan.assetIndexUrl) return [];
    util.ensureDir(path.dirname(idxFile));
    if (bus) bus.emit('dl:stage', { text: 'Telechargement de l\'index des ressources…' });
    const body = await http.download(plan.assetIndexUrl, idxFile, { token, retries: 3 });
    idx = JSON.parse(fs.readFileSync(body.file, 'utf8'));
  }
  const objects = idx.objects || {};

  /*  L'index des ressources est desormais range par NOM LOGIQUE
      ("icons/icon_128x128.png") et le condensat SHA-1 se trouve dans la
      valeur. Construire l'URL a partir de la cle renvoyait un 404 sur
      chaque ressource : le telechargement de la version bloquait a
      l'etape "assets", la barre de progression restait figee et
      l'installation n'aboutissait jamais.
      Les quelques index d'origine (cle = condensat) restent acceptes.  */
  return Object.keys(objects).map(function (cle) {
    const o = objects[cle] || {};
    const hash = o.hash || cle;
    const nom  = o.name || cle;
    const cleEstHash = /^[0-9a-f]{40}$/i.test(cle);

    /*  Les versions anterieures a 1.6 ne savent pas lire le magasin
        d'objets : elles attendent les fichiers dans assets/minecraft.  */
    const dest = (!cleEstHash && plan.assetIndexId === 'pre-1.6')
      ? path.join(plan.assetsDir, 'minecraft', nom)
      : path.join(plan.assetsDir, 'objects', hash.slice(0, 2), hash);

    return {
      kind: 'asset',
      label: 'resource ' + nom,
      url: 'https://resources.download.minecraft.net/' + hash.slice(0, 2) + '/' + hash,
      dest: dest,
      sha1: hash,
      size: o.size
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Telechargement                                                     */
/* ------------------------------------------------------------------ */
async function install(versionEntry, opts) {
  opts = opts || {};
  const cfg   = cfgm.load();
  const bus   = opts.bus;
  const token = opts.token || http.makeToken();

  const complet = await versionComplete(versionEntry);
  const vjson = complet.vjson;
  const plan  = buildPlan(vjson, cfg, complet.racine);
  const files = plan.files.slice();
  const skipMeta = !!opts.skipMeta;

  // assets
  let assetList = [];
  try {
    assetList = await assetObjects(plan, token, bus);
  } catch (e) {
    bus.emit('dl:error', { message: 'Index des assets illisible : ' + e.message });
  }
  files.push(...assetList);

  // filtre : deja presents et complets
  const todo = files.filter(f => {
    try {
      const st = fs.statSync(f.dest);
      return !(f.size && st.size === f.size);
    } catch (e) { return true; }
  });

  /*  Le total porte sur ce qu'il reste TELECHARGER, pas sur la
      totalite des fichiers. Avec l'ancien calcul, un fichier deja
      present comptait dans le total sans jamais compter dans les
      octets faits : la barre n'atteignait jamais 100 %.            */
  const totals = todo.reduce((a, f) => a + (f.size || 0), 0);
  const state  = {
    version: plan.id, total: totals, done: 0, doneBytes: 0,
    files: todo.length, filesDone: 0, current: '', speed: 0,
    assetsDone: 0, assetsTotal: 0
  };

  // progression globale : on agrege les octets par fichier
  const perFile = new Map();
  const doneSet = new Set();
  let speedMark = { t: Date.now(), bytes: 0 };
  let dernierRendu = 0;
  let renduEnAttente = false;

  function emitProgress() {
    bus.emit('dl:progress', {
      version: state.version,
      total: state.total,
      doneBytes: state.doneBytes,
      files: state.files,
      filesDone: state.filesDone,
      current: state.current,
      speed: state.speed
    });
  }

  const bump = (file, got) => {
    const prev = perFile.get(file.dest) || 0;
    const delta = Math.max(0, got - prev);
    perFile.set(file.dest, got);
    state.doneBytes += delta;
    if (file.size && got >= file.size && !doneSet.has(file.dest)) {
      doneSet.add(file.dest);
      state.filesDone++;
      if (file.kind === 'asset') state.assetsDone++;
    }
    const now = Date.now();
    const dt = (now - speedMark.t) / 1000;
    if (dt >= 0.4) {
      const inst = (state.doneBytes - speedMark.bytes) / dt;
      state.speed = state.speed ? state.speed * 0.5 + inst * 0.5 : inst;
      speedMark = { t: now, bytes: state.doneBytes };
    }
    /*  Les ressources sont des milliers de petits fichiers : emettre un
        evenement a chaque paquet recu saturait l'interface, qui
        reconstruisait toute la zone de progression des milliers de fois
        par seconde et finissait par figer. On limite a 10 rafraichis
        par seconde, et on force le dernier.                          */
    if (now - dernierRendu >= 100) { dernierRendu = now; emitProgress(); }
    else if (!renduEnAttente) {
      renduEnAttente = true;
      setTimeout(function () {
        renduEnAttente = false; dernierRendu = Date.now(); emitProgress();
      }, 100);
    }
  };

  const gros = todo.filter(f => f.kind !== 'asset');
  const ress = todo.filter(f => f.kind === 'asset');
  state.assetsTotal = ress.length;

  const echecs = [];
  function noteEchec(f, message) {
    if (echecs.length < 50) echecs.push({ name: f.label, message: message });
    bus.emit('dl:error', { name: f.label, message: message });
  }

  async function worker(list, concurrents) {
    let i = 0;
    async function boucle() {
      while (i < list.length) {
        if (token.cancelled) return;
        const f = list[i++];
        state.current = f.kind === 'asset'
          ? 'Ressources (' + state.assetsDone + '/' + state.assetsTotal + ')'
          : f.label;
        if (f.kind !== 'asset') bus.emit('dl:file', { name: f.label, url: f.url, size: f.size });
        try {
          await http.download(f.url, f.dest, {
            token,
            sha1: cfg.verifySha1 ? f.sha1 : null,
            onProgress: (got) => bump(f, got)
          });
        } catch (e) {
          if (e.cancelled || token.cancelled) return;
          noteEchec(f, e.message);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, concurrents) }, boucle));
  }

  bus.emit('dl:start', {
    version: plan.id, total: totals, files: todo.length, todo: todo.length,
    assets: ress.length
  });

  if (!todo.length) bus.emit('dl:stage', { text: 'Version deja installee, rien a telecharger.' });

  /*  Deux files : les gros fichiers (client, bibliotheques) peu de
      paralleles, les ressources tres nombreuses et tres petites en
      demandent beaucoup plus, leur cout etant domine par l'attente
      reseau et non par la bande passante.                              */
  const concGros = Math.max(1, Math.min(8, cfg.maxDownloads || 6));
  const concRess = Math.max(4, Math.min(24, (cfg.maxDownloads || 6) * 3));
  await Promise.all([worker(gros, concGros), worker(ress, concRess)]);

  state.current = '';
  emitProgress();

  // extraction des natives
  if (plan.natives.length) {
    bus.emit('dl:stage', { text: 'Extraction des bibliotheques natives…' });
    await extractNatives(plan.natives, plan);
  }

  // metadonnees : un profil de mod loader ecrit lui-meme son JSON,
  // on ne l'ecrase pas avec la version fusionnee.
  if (!opts.skipMeta) util.writeJSON(path.join(plan.vdir, plan.id + '.json'), vjson);

  bus.emit('dl:done', {
    version: plan.id, failed: echecs,
    bytes: totals,
    dir: plan.dir
  });
  return { version: plan.id, failed: echecs, dir: plan.dir, bytes: totals };
}

async function extractNatives(jars, plan) {
  const dest = plan.nativesDir || path.join(plan.vdir, 'natives');
  util.ensureDir(dest);
  let erreurs = [];
  for (const jar of jars) {
    if (!util.exists(jar)) continue;
    try {
      util.extractZip(jar, dest);
    } catch (e) {
      erreurs.push(jar + ' : ' + e.message);
    }
  }
  if (erreurs.length) {
    throw new Error('Extraction des bibliotheques natives impossible : ' + erreurs.slice(0, 3).join(' ; '));
  }
  return dest;
}

/* ------------------------------------------------------------------ */
/*  Heritage des profils de mod loaders                                */
/* ------------------------------------------------------------------ */

/*  Charge le JSON d'une version a partir de son identifiant, en
    piochant dans le manifeste si le fichier n'est pas encore local. */
async function versionParId(id) {
  const cfg = cfgm.load();
  const file = path.join(cfg.gameDir, 'versions', id, id + '.json');
  if (util.exists(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* on retelecharge */ }
  }
  const man = await getManifest(false);
  const found = (man.versions || []).find(v => v.id === id);
  if (!found) throw new Error('Version de base introuvable : ' + id);
  return fetchVersionJson(found);
}

/*  Les profils Fabric / NeoForge / Forge declarent « inheritsFrom » :
    ils reutilisent le client et les bibliotheques de la version de
    base, avec leurs propres bibliotheques par-dessus. Sans resolution
    de cette chaine, le lanceur chercherait un client.jar dans le
    dossier du profil — ou il n'existe pas — et le jeu refuserait de
    demarrer. On fusionne donc toute la chaine, du plus ancien au plus
    recent, le plus recent l'emportant.                                */
async function versionComplete(entry) {
  const vjson = await fetchVersionJson(entry);
  if (!vjson.inheritsFrom) return { vjson: vjson, racine: vjson.id };

  const chaine = [];
  let courant = vjson;
  let garde = 0;
  while (courant && courant.inheritsFrom && garde++ < 8) {
    chaine.unshift(courant);
    courant = await versionParId(courant.inheritsFrom);
  }
  if (courant) chaine.unshift(courant);

  let fusion = {};
  let libs = [];
  for (const v of chaine) {
    fusion = Object.assign(fusion, v);
    libs = libs.concat(v.libraries || []);
  }
  fusion.libraries = libs;
  fusion.id = vjson.id;
  return { vjson: fusion, racine: chaine.length ? chaine[0].id : vjson.id };
}

/* ------------------------------------------------------------------ */
/*  Versions installees                                                */
/* ------------------------------------------------------------------ */
async function fetchVersionJson(entry) {
  const cfg = cfgm.load();
  const dir = path.join(cfg.gameDir, 'versions', entry.id);
  const file = path.join(dir, entry.id + '.json');
  if (util.exists(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* retelecharge */ }
  }
  util.ensureDir(dir);
  const r = await http.download(entry.url, file, { retries: 3 });
  return JSON.parse(fs.readFileSync(r.file, 'utf8'));
}

function installedVersions() {
  const cfg = cfgm.load();
  const root = path.join(cfg.gameDir, 'versions');
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return out; }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const jar = path.join(root, d.name, d.name + '.jar');
    const js  = path.join(root, d.name, d.name + '.json');
    if (!util.exists(js)) continue;
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(js, 'utf8')); } catch (e) {}
    /*  Un profil de mod loader (Fabric, NeoForge) n'a pas de jar a lui :
        il herite du client de sa version mere.                          */
    let installee = util.exists(jar);
    if (!installee && meta.inheritsFrom) {
      installee = util.exists(path.join(root, meta.inheritsFrom, meta.inheritsFrom + '.jar'));
    }
    if (!installee) continue;
    const st = util.dirSize(path.join(root, d.name));
    out.push({
      id: d.name,
      type: meta.type || 'release',
      releaseTime: meta.releaseTime || '',
      size: st.size,
      assets: util.exists(path.join(cfg.gameDir, 'assets', 'indexes')) ? util.dirSize(path.join(cfg.gameDir, 'assets')).size : 0,
      natives: util.exists(path.join(root, d.name, 'natives'))
    });
  }
  out.sort((a, b) => (b.releaseTime || '').localeCompare(a.releaseTime || ''));
  return out;
}

function isInstalled(id) {
  const cfg = cfgm.load();
  const dir = path.join(cfg.gameDir, 'versions', id);
  if (util.exists(path.join(dir, id + '.jar'))) return true;
  /*  Profil de mod loader : le client vient de la version mere.       */
  const meta = util.readJSON(path.join(dir, id + '.json'), null);
  if (meta && meta.inheritsFrom) {
    return util.exists(path.join(cfg.gameDir, 'versions', meta.inheritsFrom, meta.inheritsFrom + '.jar'));
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Detection de Java                                                  */
/* ------------------------------------------------------------------ */
async function probeJava(exe) {
  /*  javaw.exe n'ecrit rien sur la console : c'est l'interet de cette
      variante, celle qui evite la fenetre noire. Interrogee telle
      quelle, elle ne renverrait jamais sa version et le Java paraitrait
      absent. On passe donc par java.exe, sa cousine console.          */
  const variante = exe.replace(/javaw\.exe$/i, 'java.exe');
  const cible = (variante !== exe && util.exists(variante)) ? variante : exe;
  const r = await util.run(cible, ['-version'], 15000);
  const txt = (r.stderr || '') + (r.stdout || '');
  const m = txt.match(/version "([^"]+)"/);
  const raw = m ? m[1] : '';
  let major = 0;
  if (raw.startsWith('1.')) major = parseInt(raw.split('.')[1], 10) || 0;
  else major = parseInt(raw.split('.')[0], 10) || 0;
  return { version: raw || 'inconnue', major, ok: r.code === 0 && major > 0 };
}

function javaCandidates() {
  const list = [];
  const add = p => { if (p && !list.includes(p)) list.push(p); };

  const cfgPath = (cfgm.load().javaPath || '').trim();
  if (cfgPath) add(cfgPath);

  if (process.env.JAVA_HOME) {
    add(path.join(process.env.JAVA_HOME, 'bin', 'javaw.exe'));
    add(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
  }

  const roots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Zulu',
    'C:\\Program Files\\Amazon Corretto',
    'C:\\Program Files (x86)\\Java',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium')
  ];
  for (const root of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { continue; }
    for (const d of dirs) {
      const p = path.join(root, d.name, 'bin');
      add(path.join(p, 'javaw.exe'));
      add(path.join(p, 'java.exe'));
    }
  }
  return list;
}

async function findJava(needMajor) {
  const need = needMajor || 8;
  const tested = [];
  for (const exe of javaCandidates()) {
    if (!util.exists(exe)) continue;
    const info = await probeJava(exe);
    tested.push({ path: exe, ...info });
    /*  Le chemin de l'executable fait partie du resultat : sans lui,
        l'appelant ne sait pas ou se trouve le Java retenu.            */
    if (info.ok && info.major >= need) return { found: true, need, path: exe, ...info, tested };
  }
  return { found: false, need, path: '', version: '', major: 0, tested };
}

function downloadUrlAdoptium(major) {
  return 'https://api.adoptium.net/v3/binary/latest/' + (major || 17) + '/ga/windows/x64/jdk/hotspot/normal/eclipse';
}

/* ------------------------------------------------------------------ */
/*  Installation automatique de Java                                    */
/* ------------------------------------------------------------------ */

/*  Temurin est aussi distribue en archive zip. C'est la forme qu'on
    utilise ici : aucune installation, aucun droit administrateur, le
    dossier est simplement extrait dans l'espace de l'application et le
    launcher y pointe. Un destinataire du launcher peut donc jouer sans
    installer quoi que ce soit.                                          */
function downloadUrlAdoptiumZip(major) {
  return downloadUrlAdoptium(major) +
    '?project=jdk&image_type=jdk&os=windows&architecture=x64&package_type=zip';
}

function javaDir() { return path.join(util.appRoot(), 'java'); }

async function installJava(major, bus) {
  const version = major || 17;
  const zip = path.join(os.tmpdir(), 'xrn-temurin-' + version + '-' + Date.now() + '.zip');
  if (bus) bus.emit('java:stage', { text: 'Telechargement de Temurin ' + version + '…' });

  await http.download(downloadUrlAdoptiumZip(version), zip, {
    retries: 3,
    onProgress: (done, total) => { if (bus) bus.emit('java:progress', { done: done, total: total }); }
  });

  const dest = javaDir();
  util.rmrf(dest);
  util.ensureDir(dest);
  if (bus) bus.emit('java:stage', { text: 'Extraction de Java…' });
  const n = util.extractZip(zip, dest);
  try { fs.unlinkSync(zip); } catch (e) {}

  /*  L'archive contient un dossier de premier niveau du genre
      "jdk-21.0.12+1" : on cherche l'executable a l'interieur.      */
  let exe = path.join(dest, 'bin', 'javaw.exe');
  if (!util.exists(exe)) {
    for (const d of util.listDir(dest)) {
      if (!d.dir) continue;
      const p = path.join(d.path, 'bin', 'javaw.exe');
      if (util.exists(p)) { exe = p; break; }
    }
  }
  if (!util.exists(exe)) {
    throw new Error('Extraction de Java incomplete : javaw.exe est introuvable dans l\'archive.');
  }
  /*  javaw.exe n'ecrit rien sur la console : c'est tout l'interet de
      cette variante. Pour lire la version, on interroge l'autre
      executable, java.exe, qui ecrit bien sur la sortie d'erreur.     */
  const exeConsole = exe.replace(/javaw\.exe$/i, 'java.exe');
  const info = await probeJava(util.exists(exeConsole) ? exeConsole : exe);
  if (!info.ok) throw new Error('Le Java extrait ne fonctionne pas (' + info.version + ').');
  if (bus) bus.emit('java:stage', { text: 'Java ' + info.version + ' pret.' });
  return { path: exe, major: info.major, version: info.version, fichiers: n };
}

/* ------------------------------------------------------------------ */
/*  Lancement                                                          */
/* ------------------------------------------------------------------ */
function killGame(pid) {
  try { process.kill(pid); } catch (e) {}
}

/* ------------------------------------------------------------------ */
/*  Arguments de lancement                                             */
/* ------------------------------------------------------------------ */

function appRootGuess() {
  try { if (typeof __dirname === 'string' && __dirname) return __dirname; } catch (e) {}
  try { if (process && process.cwd()) return process.cwd(); } catch (e) {}
  return '.';
}
function pkgVersion() {
  try {
    const pj = util.readJSON(path.join(appRootGuess(), 'package.json'), null);
    return (pj && pj.version) || '3.5.0';
  } catch (e) { return '3.5.0'; }
}

/*  Valeurs que le client sait remplacer dans les arguments qu'il
    declare lui-meme. La liste reprend celle du lanceur officiel.       */
function substitutions(plan, opts) {
  const cfg = cfgm.load();
  return {
    auth_player_name: opts.username || '',
    version_name: plan.id,
    game_directory: plan.dir,
    assets_root: plan.assetsDir,
    assets_index_name: plan.clientId,
    auth_uuid: String(opts.uuid || '').replace(/-/g, ''),
    auth_access_token: opts.accessToken || '0',
    auth_session: opts.session || '',
    clientid: '',
    auth_xuid: '',
    user_type: opts.userType || 'msla',
    version_type: plan.type || 'release',
    resolution_width: String(cfg.gameWidth || 1280),
    resolution_height: String(cfg.gameHeight || 720),
    quickPlayPath: opts.quickPlayPath || '',
    quickPlaySingleplayer: opts.world || '',
    quickPlayMultiplayer: opts.quickPlayMultiplayer || '',
    quickPlayRealms: opts.quickPlayRealms || '',
    natives_directory: plan.nativesDir,
    classpath: plan.classpath.join(';'),
    classpath_separator: ';',
    library_directory: path.join(plan.dir, 'libraries'),
    launcher_name: 'XRNLauncher',
    launcher_version: pkgVersion()
  };
}

function appliquerPlaceholders(valeur, subst) {
  return String(valeur).replace(/\$\{([a-zA-Z0-9_]+)\}/g, function (m, cle) {
    return Object.prototype.hasOwnProperty.call(subst, cle) ? subst[cle] : m;
  });
}

/*  Regles Mojang : conditions de systeme d'exploitation et options
    demandees par l'utilisateur (resolution, quick play...).            */
function reglesApplies(rules, features) {
  if (!rules || !rules.length) return true;
  let autorise = false;
  for (const r of rules) {
    if (!r) continue;
    if (r.features) {
      let ok = true;
      for (const k of Object.keys(r.features)) {
        if (!features[k]) { ok = false; break; }
      }
      if (!ok) continue;
    }
    if (r.os && !matchOs(r)) continue;
    autorise = (r.action === 'allow');
  }
  return autorise;
}

/*  Depile une liste d'arguments declares : chaine simple, ou objet
    conditionnel dont la valeur peut etre une chaine ou un tableau.   */
function depiler(liste, subst, features) {
  const out = [];
  for (const a of (liste || [])) {
    if (typeof a === 'string') { out.push(appliquerPlaceholders(a, subst)); continue; }
    if (!a) continue;
    if (!reglesApplies(a.rules, features)) continue;
    const vals = Array.isArray(a.value) ? a.value : [a.value];
    for (const v of vals) {
      if (v === undefined || v === null) continue;
      out.push(appliquerPlaceholders(v, subst));
    }
  }
  return out;
}

/*  Session encodee pour les clients anterieurs a 1.13 :
    "token:<jeton>:<uuid>:<pseudo>" en base64.                          */
function sessionLegacy(opts) {
  try {
    const brut = 'token:' + (opts.accessToken || '0') + ':' +
                 String(opts.uuid || '').replace(/-/g, '') + ':' +
                 (opts.username || 'Joueur');
    return Buffer.from(brut, 'utf8').toString('base64');
  } catch (e) { return ''; }
}

/*  Les versions modernes (1.13 et plus) declarent elles-memes leurs
    arguments, avec des conditions ; le lanceur officiel se contente de
    les appliquer. Les versions plus anciennes n'en declarent pas, on
    reconstitue alors la ligne a la main comme avant.                    */
function buildArgs(plan, opts) {
  const cfg = cfgm.load();
  const ram = Math.max(1, Number(opts.ramGB || cfg.ramGB || 4));
  const nativesDir = plan.nativesDir || path.join(plan.vdir, 'natives');

  const subst = substitutions(plan, opts);
  const features = {
    is_demo_user: false,
    has_custom_resolution: true,
    has_quick_plays_support: true,
    is_quick_play_singleplayer: !!opts.world,
    is_quick_play_multiplayer: !!opts.quickPlayMultiplayer,
    is_quick_play_realms: !!opts.quickPlayRealms,
    supports_quick_play_multiplayer: true
  };

  const jvm = [];
  if (opts.extraJavaArgs) jvm.push(...String(opts.extraJavaArgs).split(/\s+/).filter(Boolean));
  jvm.push('-Xmx' + Math.round(ram * 1024) + 'M');
  jvm.push('-Dfile.encoding=UTF-8');

  const jeu = [];
  const mainClass = plan.mainClass || 'net.minecraft.client.main.Main';

  if (plan.arguments && plan.arguments.jvm && plan.arguments.jvm.length) {
    jvm.push(...depiler(plan.arguments.jvm, subst, features));
  } else {
    /*  Les versions anciennes ne declarent pas leurs arguments : on
        reconstruit la ligne a la main, comme le fait le lanceur
        officiel. Le classpath est indispensable : la classe principale
        est designee a part, elle n'est plus deduite du jar.          */
    jvm.push('-Djava.library.path=' + nativesDir);
    jvm.push('-Dorg.lwjgl.librarypath=' + nativesDir);
    jvm.push('-Dio.netty.native.workdir=' + nativesDir);
    jvm.push('-cp', plan.classpath.join(';'));
  }

  if (plan.arguments && plan.arguments.game && plan.arguments.game.length) {
    jeu.push(...depiler(plan.arguments.game, subst, features));
  } else {
    jeu.push('--username', opts.username);
    jeu.push('--version', plan.id);
    jeu.push('--gameDir', plan.dir);
    jeu.push('--assetsDir', plan.assetsDir);
    jeu.push('--assetIndex', plan.clientId);
    jeu.push('--uuid', String(opts.uuid || '').replace(/-/g, ''));
    jeu.push('--accessToken', opts.accessToken || '0');
    jeu.push('--userType', opts.userType || 'msla');
    jeu.push('--versionType', plan.type || 'release');
    jeu.push('--width', String(cfg.gameWidth || 1280));
    jeu.push('--height', String(cfg.gameHeight || 720));
    /*  Les clients anterieurs a 1.13 s'attendent une session encodee ;
        sans elle ils affichent "Failed to verify username".          */
    jeu.push('--session', opts.session || sessionLegacy(opts));
  }

  /*  La classe principale se place entre les options de la JVM et les
      arguments du jeu. Les versions modernes la fournissent dans leur
      JSON : c'est ce qui permet a un profil Fabric de lancer Knot
      plutot que le client vanilla.                                      */
  return { jvm: jvm, mainClass: mainClass, jeu: jeu };
}

async function launch(opts, bus) {
  const cfg = cfgm.load();
  const entry = { id: opts.version, url: opts.versionUrl };
  const complet = await versionComplete(entry);
  const vjson = complet.vjson;
  const plan = buildPlan(vjson, cfg, complet.racine);

  if (!util.exists(plan.jar)) {
    throw new Error('Version ' + plan.id + ' non installee. Lancez l\'installation d\'abord.');
  }

  const java = await findJava(plan.javaMajor);
  if (!java.found) {
    const e = new Error('Java ' + plan.javaMajor + '+ introuvable. Installez un JDK (Temurin) ou indiquez le chemin dans Parametres.');
    e.code = 'nojava';
    e.detail = { need: plan.javaMajor, url: downloadUrlAdoptium(Math.max(17, plan.javaMajor)), tested: java.tested };
    throw e;
  }

  const exe = java.path.toLowerCase().endsWith('java.exe') && !opts.forceWindow
    ? java.path
    : java.path.replace(/javaw\.exe$/i, 'javaw.exe');

  const built = buildArgs(plan, opts);
  const args = built.jvm.concat([built.mainClass], built.jeu);
  bus.emit('game:spawn', { exe, args: args.map(a => (a.length > 120 ? a.slice(0, 60) + '…' : a)) });

  const child = spawn(exe, args, {
    cwd: plan.dir,
    windowsHide: false,
    detached: false,
    env: Object.assign({}, process.env, { MINECRAFT_JAVA_HOME: path.dirname(java.path) })
  });

  child.stdout.on('data', d => bus.emit('game:log', { stream: 'out', line: clean(String(d)) }));
  child.stderr.on('data', d => bus.emit('game:log', { stream: 'err', line: clean(String(d)) }));
  child.on('error', e => bus.emit('game:exit', { code: -1, error: e.message }));
  child.on('exit', code => bus.emit('game:exit', { code }));

  return { pid: child.pid, exe, version: plan.id, javaMajor: java.major };
}

function clean(s) {
  return s.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').split(/\r?\n/).filter(Boolean).join('\n');
}

module.exports = {
  getManifest, buildPlan, install, installedVersions, isInstalled, fetchVersionJson,
  versionComplete, versionParId, buildArgs, matchOs, mavenPath,
  findJava, launch, killGame, downloadUrlAdoptium, downloadUrlAdoptiumZip,
  installJava, javaDir, allowRules, OUR_ARCH, OUR_OS
};