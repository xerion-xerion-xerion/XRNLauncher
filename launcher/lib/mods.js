'use strict';
/*  lib/mods.js — dossier de mods, detecteur de mod loaders, installation
                    de Fabric et de NeoForge.

    Le dossier « mods » n'a aucun effet sur le jeu vanilla : sans chargeur
    de mods installe, Minecraft ignore completement son contenu. D'ou la
    partie installateur, qui rend la zone de depot reellement utile.     */

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const util = require('./util');
const cfgm = require('./config');
const http = require('./http');
const game = require('./game');

const FABRIC_META   = 'https://meta.fabricmc.net/v2';
const FABRIC_MAVEN  = 'https://maven.fabricmc.net/';
const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge';

/* ------------------------------------------------------------------ */
/*  Dossier des mods                                                    */
/* ------------------------------------------------------------------ */
function modsDir() {
  return path.join(cfgm.load().gameDir, 'mods');
}

function list() {
  const dir = modsDir();
  util.ensureDir(dir);
  return util.listDir(dir, { withSize: true })
    .filter(e => !e.dir && /\.jar$/i.test(e.name))
    .map(e => ({ name: e.name, size: e.size, mtime: e.mtime }));
}

/*  Ajoute des fichiers au dossier des mods.
    source : tableau de chemins absolus.                                 */
function add(sources) {
  const dir = modsDir();
  util.ensureDir(dir);
  const ajoutes = [];
  const refuses = [];
  for (const src of (sources || [])) {
    if (!src) continue;
    const nom = path.basename(src);
    if (!/\.jar$/i.test(nom)) { refuses.push({ name: nom, raison: 'seuls les fichiers .jar sont acceptes' }); continue; }
    if (!util.exists(src)) { refuses.push({ name: nom, raison: 'fichier introuvable' }); continue; }
    const dest = path.join(dir, nom);
    try {
      fs.copyFileSync(src, dest);
      ajoutes.push(nom);
    } catch (e) {
      refuses.push({ name: nom, raison: e.message });
    }
  }
  return { ajoutes: ajoutes, refuses: refuses, mods: list() };
}

function remove(nom) {
  const dir = modsDir();
  const cible = path.join(dir, path.basename(nom));
  if (!cible.startsWith(dir)) return { ok: false, message: 'chemin refuse' };
  try { fs.unlinkSync(cible); return { ok: true, mods: list() }; }
  catch (e) { return { ok: false, message: e.message }; }
}

function openFolder() { return util.openExplorer(modsDir()); }

/* ------------------------------------------------------------------ */
/*  Detection des chargeurs installes                                   */
/* ------------------------------------------------------------------ */
const LOADERS = [
  { id: 'fabric',   nom: 'Fabric',   motif: /^fabric-loader-.*\.jar$/i },
  { id: 'neoforge', nom: 'NeoForge', motif: /^neoforge-.*\.jar$/i },
  { id: 'forge',    nom: 'Forge',    motif: /^forge-.*\.jar$/i },
  { id: 'quilt',    nom: 'Quilt',    motif: /^quilt-loader-.*\.jar$/i }
];

/*  Chargeurs presents dans le dossier de la version donnee.             */
function loadersDe(versionId) {
  if (!versionId) return [];
  const dir = path.join(cfgm.load().gameDir, 'versions', versionId);
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { names = []; }
  const trouve = [];
  for (const l of LOADERS) {
    const m = names.find(n => l.motif.test(n));
    if (m) trouve.push({ id: l.id, nom: l.nom, jar: m, version: versionId });
  }
  if (trouve.length) return trouve;

  /*  Un profil construit par le launcher (Fabric, NeoForge) n'a pas
      de jar a lui : il se deduit de son JSON, qui declare la version
      de base dont il herite et la classe principale du chargeur.     */
  const meta = util.readJSON(path.join(dir, versionId + '.json'), null);
  if (meta && meta.inheritsFrom) {
    const mc = String(meta.mainClass || '');
    if (mc.indexOf('fabricmc') !== -1) trouve.push({ id: 'fabric', nom: 'Fabric', jar: null, version: versionId });
    else if (mc.indexOf('neoforge') !== -1) trouve.push({ id: 'neoforge', nom: 'NeoForge', jar: null, version: versionId });
    else if (mc.indexOf('quilt') !== -1) trouve.push({ id: 'quilt', nom: 'Quilt', jar: null, version: versionId });
    else if (mc.indexOf('forge') !== -1) trouve.push({ id: 'forge', nom: 'Forge', jar: null, version: versionId });
  }
  return trouve;
}

/*  Toutes les versions installees qui sont des profils de mod loader.  */
function profilsMod() {
  const out = [];
  for (const v of game.installedVersions()) {
    const l = loadersDe(v.id);
    if (!l.length) continue;
    const meta = util.readJSON(path.join(cfgm.load().gameDir, 'versions', v.id, v.id + '.json'), null);
    out.push({
      version: v.id,
      loader: l[0],
      base: (meta && meta.inheritsFrom) || v.id
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Fabric                                                               */
/* ------------------------------------------------------------------ */
async function fabricLoaderStable() {
  const list = await http.getJSON(FABRIC_META + '/versions/loader');
  const stable = list.filter(v => v.stable);
  return (stable[0] || list[0] || {}).version;
}

/*  Construit le profil Fabric d'une version de Minecraft.

    L'API meta de Fabric ne distribue plus d'installateur : elle donne
    en revanche tout ce qu'il faut pour ecrire le profil soi-meme, ce
    que font les lanceurs modernes. Le profil herite de la version de
    base (inheritsFrom) et y ajoute les bibliotheques du chargeur ;
    il doit donc etre lance avec la classe principale du chargeur, ce
    que le lanceur sait faire depuis que les versions modernes
    declarent elles-memes leurs arguments.                                */
async function fabricProfil(mcVersion) {
  const loader = await fabricLoaderStable();
  const url = FABRIC_META + '/versions/loader/' + encodeURIComponent(mcVersion) +
              '/' + encodeURIComponent(loader);
  const combo = await http.getJSON(url);
  if (!combo || !combo.launcherMeta || !combo.launcherMeta.mainClass) {
    throw new Error('Aucun profil Fabric disponible pour Minecraft ' + mcVersion + '.');
  }
  const lm = combo.launcherMeta;
  const libs = [];
  libs.push({ name: 'net.fabricmc:fabric-loader:' + combo.loader.version, url: FABRIC_MAVEN });
  libs.push({ name: combo.intermediary.maven, url: FABRIC_MAVEN });
  for (const set of ['client', 'common', 'development']) {
    for (const l of (lm.libraries[set] || [])) libs.push({ name: l.name, url: l.url });
  }
  return {
    loader: combo.loader.version,
    intermediary: combo.intermediary.version,
    mainClass: lm.mainClass.client,
    libraries: libs,
    profileId: 'fabric-loader-' + combo.loader.version + '-' + mcVersion
  };
}

/*  Informations affichees dans l'interface. */
async function fabricInstallateur(mcVersion) {
  const p = await fabricProfil(mcVersion);
  return { loader: p.loader, version: p.loader, profil: p.profileId, mainClass: p.mainClass };
}

/* ------------------------------------------------------------------ */
/*  NeoForge                                                             */
/* ------------------------------------------------------------------ */
function baseMinecraft(neoVersion) {
  /*  "20.4.190"  -> 1.20.4      "21.1.172" -> 1.21.1
      "26.3.0.89" -> 26.3                                        */
  const parts = String(neoVersion).split('.');
  if (parts.length < 2) return null;
  const base = parts.slice(0, parts.length - 1).join('.');
  if (base.indexOf('1.') === 0) return base;
  if (parts.length >= 3 && base.split('.').length === 2) {
    const an = parseInt(base.split('.')[0], 10);
    if (an >= 20 && an < 100) return '1.' + base;
  }
  return base;
}

async function neoforgePour(mcVersion) {
  const texte = await http.getText(NEOFORGE_MAVEN + '/maven-metadata.xml');
  const versions = (String(texte).match(/<version>([^<]+)<\/version>/g) || [])
    .map(s => s.replace(/<\/?version>/g, ''));
  if (!versions.length) throw new Error('Liste NeoForge introuvable');
  const cible = versions.filter(v => baseMinecraft(v) === mcVersion);
  const pool = cible.length ? cible : versions;
  const dernier = pool[pool.length - 1];
  return {
    version: dernier,
    url: NEOFORGE_MAVEN + '/' + dernier + '/neoforge-' + dernier + '-installer.jar'
  };
}

/* ------------------------------------------------------------------ */
/*  Installation                                                         */
/* ------------------------------------------------------------------ */
async function installerJava(bus) {
  const j = await game.findJava(17);
  if (!j.found) {
    const e = new Error('Java 17+ introuvable : installez Temurin pour pouvoir installer un mod loader.');
    e.code = 'nojava';
    e.detail = { need: 17, url: game.downloadUrlAdoptium(17) };
    throw e;
  }
  return j;
}

async function installFabric(mcVersion, bus) {
  const info = await fabricProfil(mcVersion);
  const cfg = cfgm.load();
  const dir = path.join(cfg.gameDir, 'versions', info.profileId);
  util.ensureDir(dir);

  /*  La version de base doit etre installee : le profil n'a pas son
      propre client, il emprunte celui de sa mere.                      */
  const mere = await game.versionComplete({ id: mcVersion, url: null });
  if (!game.isInstalled(mcVersion)) {
    const e = new Error('Minecraft ' + mcVersion + ' n\'est pas installee : installez-la d\'abord.');
    e.code = 'base-missing';
    throw e;
  }

  const profile = {
    id: info.profileId,
    inheritsFrom: mcVersion,
    type: 'release',
    releaseTime: mere.vjson.releaseTime || new Date().toISOString(),
    time: new Date().toISOString(),
    mainClass: info.mainClass,
    libraries: info.libraries
  };
  if (mere.vjson.assetIndex) profile.assetIndex = mere.vjson.assetIndex;
  if (mere.vjson.assets) profile.assets = mere.vjson.assets;

  util.writeJSON(path.join(dir, info.profileId + '.json'), profile);

  if (bus) bus.emit('mods:stage', { text: 'Telechargement des bibliotheques Fabric…' });
  /*  skipMeta : le profil vient d'etre ecrit, on ne le remplace pas
      par la version fusionnee.                                         */
  await game.install({ id: info.profileId, url: null }, { bus, skipMeta: true });

  return { loader: 'Fabric', version: info.loader, profil: info.profileId };
}

async function installNeoForge(mcVersion, bus) {
  const java = await installerJava(bus);
  const info = await neoforgePour(mcVersion);
  const tmp  = path.join(os.tmpdir(), 'xrn-neoforge-' + Date.now());
  util.ensureDir(tmp);
  const jar = path.join(tmp, 'neoforge-installer.jar');
  if (bus) bus.emit('mods:stage', { text: 'Telechargement de l\'installateur NeoForge ' + info.version + '…' });
  await http.download(info.url, jar, { retries: 3 });

  if (bus) bus.emit('mods:stage', { text: 'Installation de NeoForge pour ' + mcVersion + '…' });
  const gameDir = cfgm.load().gameDir;
  const r = await util.run(java.path, ['-jar', jar, '--installClient', gameDir], 900000);

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}

  if (r.code !== 0) {
    const e = new Error('L\'installateur NeoForge a echoue (code ' + r.code + '). ' +
      String(r.stderr || r.stdout || '').split(/\r?\n/).filter(Boolean).slice(-2).join(' '));
    e.code = 'install-fail';
    throw e;
  }
  return { loader: 'NeoForge', version: info.version, profil: 'neoforge-' + info.version };
}

/* ------------------------------------------------------------------ */
/*  Etat pour l'interface                                                */
/* ------------------------------------------------------------------ */
function etat() {
  const mods = list();
  return {
    dossier: modsDir(),
    mods: mods,
    total: mods.reduce((a, m) => a + m.size, 0),
    profils: profilsMod()
  };
}

module.exports = {
  modsDir, list, add, remove, openFolder, etat,
  loadersDe, profilsMod, fabricProfil, fabricInstallateur, fabricLoaderStable,
  neoforgePour, installFabric, installNeoForge
};
