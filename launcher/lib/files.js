'use strict';
/*  lib/files.js — sauvegardes (level.dat / NBT), explorateur de fichiers,
                   import / export d'archives ZIP (via Windows PowerShell)     */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');
const util  = require('./util');
const cfgm  = require('./config');

/* ------------------------------------------------------------------ */
/*  Lecteur NBT minimal (level.dat)                                   */
/* ------------------------------------------------------------------ */
function readNBT(buf) {
  let o = 0;
  const u8   = () => buf.readUInt8(o++);
  const i8   = () => buf.readInt8(o++);
  const i16  = () => { const v = buf.readInt16BE(o); o += 2; return v; };
  const i32  = () => { const v = buf.readInt32BE(o); o += 4; return v; };
  const i64  = () => { const v = buf.readBigInt64BE(o); o += 8; return v; };
  const f32  = () => { const v = buf.readFloatBE(o); o += 4; return v; };
  const f64  = () => { const v = buf.readDoubleBE(o); o += 8; return v; };
  const str  = () => { const n = buf.readUInt16BE(o); o += 2; const v = buf.toString('utf8', o, o + n); o += n; return v; };

  function payload(t) {
    switch (t) {
      case 1:  return i8();
      case 2:  return i16();
      case 3:  return i32();
      case 4:  return Number(i64());
      case 5:  return f32();
      case 6:  return f64();
      case 7:  { const n = i32(); const v = Buffer.from(buf.slice(o, o + n)); o += n; return v; }
      case 8:  return str();
      case 9:  { const et = u8(); const n = i32(); const a = []; for (let k = 0; k < n && n > 0; k++) a.push(payload(et)); return a; }
      case 10: { const r = {}; for (;;) { const t2 = u8(); if (t2 === 0) break; const nm = str(); r[nm] = payload(t2); } return r; }
      case 11: { const n = i32(); const a = []; for (let k = 0; k < n && n > 0; k++) a.push(i32()); return a; }
      case 12: { const n = i32(); const a = []; for (let k = 0; k < n && n > 0; k++) a.push(Number(i64())); return a; }
      default: throw new Error('type NBT inconnu : ' + t);
    }
  }
  const type = u8();
  if (type === 0) return {};
  str();                       // nom racine ignore
  return payload(type);
}

const GAME_MODES = ['Survie', 'Creatif', 'Aventure', 'Spectateur'];

function readLevelDat(file) {
  try {
    let buf = fs.readFileSync(file);
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
    const root = readNBT(buf);
    const d = (root && root.Data && typeof root.Data === 'object') ? root.Data : root;
    return {
      name: d.LevelName || '',
      lastPlayed: Number(d.LastPlayed || 0),
      gameType: GAME_MODES[d.GameType] || 'Survie',
      hardcore: !!d.hardcore,
      dataVersion: Number(d.DataVersion || 0),
      spawn: d.spawn || null
    };
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Sauvegardes                                                        */
/* ------------------------------------------------------------------ */
function savesDir() { return path.join(cfgm.load().gameDir, 'saves'); }
function backupsDir() { util.ensureDir(path.join(cfgm.load().gameDir, 'backups')); return path.join(cfgm.load().gameDir, 'backups'); }

function listSaves() {
  const dir = savesDir();
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    const level = path.join(full, 'level.dat');
    if (!util.exists(level)) continue;
    const meta = readLevelDat(level) || {};
    let st = { size: 0, mtime: Date.now() };
    try { st = fs.statSync(level); } catch (err) {}
    out.push({
      folder: e.name,
      name: meta.name || e.name,
      gameType: meta.gameType || 'Survie',
      hardcore: !!meta.hardcore,
      lastPlayed: meta.lastPlayed || st.mtimeMs,
      dataVersion: meta.dataVersion || 0,
      path: full,
      hasIcon: util.exists(path.join(full, 'icon.png')),
      size: 0,           // calculee a la demande (potentiellement lent)
      _level: level
    });
  }
  out.sort((a, b) => b.lastPlayed - a.lastPlayed);
  return out;
}

function saveSize(folder) {
  return util.dirSize(path.join(savesDir(), folder)).size;
}

function previewIcon(folder, size) {
  // renvoie le chemin d'une vignette PNG si dispo (icone du monde)
  const p = path.join(savesDir(), folder, 'icon.png');
  return util.exists(p) ? p : null;
}

function deleteSave(folder) {
  const p = path.join(savesDir(), path.basename(folder));
  if (!util.exists(p)) throw new Error('Sauvegarde introuvable');
  return util.rmrf(p);
}

function renameSave(folder, newName) {
  const from = path.join(savesDir(), path.basename(folder));
  const to   = path.join(savesDir(), path.basename(newName));
  if (util.exists(to)) throw new Error('Une sauvegarde porte deja ce nom');
  fs.renameSync(from, to);
  return to;
}

function backupSave(folder) {
  const src = path.join(savesDir(), path.basename(folder));
  if (!util.exists(src)) throw new Error('Sauvegarde introuvable');
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const zip = path.join(backupsDir(), path.basename(folder) + '-' + stamp + '.zip');
  const ps = "Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
             "[System.IO.Compression.ZipFile]::CreateFromDirectory('" +
             src.replace(/'/g, "''") + "','" + zip.replace(/'/g, "''") + "')";
  return util.run('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], 600000)
    .then(r => { if (r.code !== 0) throw new Error(r.stderr || 'Echec de la compression'); return { zip, size: util.dirSize(zip).size }; });
}

function listBackups() {
  const dir = backupsDir();
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    if (!e.isFile() || !/\.zip$/i.test(e.name)) continue;
    const st = fs.statSync(path.join(dir, e.name));
    out.push({ name: e.name, path: path.join(dir, e.name), size: st.size, mtime: st.mtimeMs });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out;
}

function importSave(archivePath, targetName) {
  const src = path.basename(archivePath);
  const dest = path.join(savesDir(), path.basename(targetName || src.replace(/\.zip$/i, '')));
  util.ensureDir(savesDir());
  if (util.exists(dest)) throw new Error('Une sauvegarde porte deja ce nom : ' + path.basename(dest));

  const ps = "Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
             "[System.IO.Compression.ZipFile]::ExtractToDirectory('" +
             archivePath.replace(/'/g, "''") + "','" + dest.replace(/'/g, "''") + "')";
  return util.run('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], 300000)
    .then(r => {
      // certaines archives contiennent un dossier racine : on aplatit
      const items = util.listDir(dest);
      if (items.length === 1 && items[0].dir && util.exists(path.join(items[0].path, 'level.dat'))) {
        const inner = items[0].path;
        for (const f of fs.readdirSync(inner)) {
          fs.renameSync(path.join(inner, f), path.join(dest, f));
        }
        util.rmrf(inner);
      }
      if (!util.exists(path.join(dest, 'level.dat'))) {
        throw new Error('Archive invalide : aucun level.dat trouve');
      }
      return dest;
    });
}

/* ------------------------------------------------------------------ */
/*  Explorateur de fichiers                                            */
/* ------------------------------------------------------------------ */
function browse(dir, depth) {
  const base = cfgm.load().gameDir;
  const target = dir ? path.resolve(dir) : base;
  if (!target.toLowerCase().startsWith(path.resolve(base).toLowerCase())) {
    throw new Error('Acces refuse : en dehors du dossier du jeu');
  }
  depth = Math.max(0, Math.min(4, depth == null ? 1 : depth));
  if (!util.exists(target)) return { path: target, name: path.basename(target), parent: null, entries: [], missing: true };

  const entries = util.listDir(target, { withSize: depth === 0 }).map(e => {
    let icon = 'file';
    if (e.dir) {
      const n = e.name.toLowerCase();
      icon = n === 'saves' ? 'saves' : n === 'resourcepacks' ? 'packs' : n === 'mods' ? 'mods'
           : n === 'screenshots' ? 'shots' : n === 'shaderpacks' ? 'shader' : n === 'versions' ? 'versions'
           : n === 'assets' ? 'assets' : n === 'libraries' ? 'lib' : n === 'config' ? 'config' : 'folder';
    } else {
      icon = /\.zip$/i.test(e.name) ? 'zip' : /\.jar$/i.test(e.name) ? 'jar' : /\.json$/i.test(e.name) ? 'json' : /\.png$/i.test(e.name) ? 'image' : 'file';
    }
    return { name: e.name, path: e.path, dir: e.dir, size: e.size, mtime: e.mtime, icon };
  });

  const parent = path.dirname(target).toLowerCase() === path.resolve(base).toLowerCase()
    ? null : path.dirname(target);

  return {
    path: target,
    name: path.basename(target) || path.dirname(target),
    parent,
    entries,
    missing: false
  };
}

/*  L'espace libre ne bouge que tres lentement, et PowerShell met une
    bonne seconde a demarrer : on le demande a la couche native
    (fs.statfsSync) et on garde la valeur une minute. Le lancement de
    PowerShell n'est plus utilise que si statfs est indisponible.        */
let cacheEspace = { t: 0, valeur: null };
async function espaceLibre(cible) {
  const maintenant = Date.now();
  if (cacheEspace.cible === cible && maintenant - cacheEspace.t < 60000) return cacheEspace.valeur;

  let valeur = null;
  try {
    if (typeof fs.statfsSync === 'function') {
      const st = fs.statfsSync(cible);
      valeur = Number(st.bavail) * Number(st.bsize);
      if (!isFinite(valeur) || valeur <= 0) valeur = null;
    }
  } catch (e) { valeur = null; }

  if (valeur === null) {
    /*  Recours ancien Node : PowerShell. Rare, et le cache evite de le
        relancer a chaque affichage.                                     */
    try {
      const r = await util.run('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        '(Get-PSDrive -Name ' + path.parse(cible).root.replace(':', '') + ').Free'], 15000);
      const f = parseInt(String(r.stdout).trim(), 10);
      valeur = isNaN(f) ? null : f;
    } catch (e) { valeur = null; }
  }

  cacheEspace = { t: maintenant, valeur, cible };
  return valeur;
}

function diskInfo() {
  const base = cfgm.load().gameDir;
  const top = browse(base, 0);
  const total = top.entries.reduce((a, e) => a + e.size, 0);
  return espaceLibre(base).then(free => ({ root: base, entries: top.entries, total, free }));
}

function deleteEntry(p) {
  const base = path.resolve(cfgm.load().gameDir);
  const target = path.resolve(p);
  if (!target.toLowerCase().startsWith(base.toLowerCase())) throw new Error('Acces refuse');
  if (target.toLowerCase() === base.toLowerCase()) throw new Error('Suppression du dossier racine refusee');
  return util.rmrf(target);
}

function createFolder(parent, name) {
  const p = path.join(parent, path.basename(name));
  util.ensureDir(p);
  return p;
}

function quickFolders() {
  const dir = cfgm.load().gameDir;
  const map = [
    ['saves', 'Sauvegardes'],
    ['resourcepacks', 'Packs de ressources'],
    ['shaderpacks', 'Packs de shaders'],
    ['mods', 'Mods'],
    ['config', 'Configuration'],
    ['screenshots', 'Captures d\'écran'],
    ['versions', 'Versions'],
    ['assets', 'Ressources'],
    ['libraries', 'Bibliothèques'],
    ['logs', 'Journaux'],
    ['backups', 'Sauvegardes ZIP']
  ];
  return map.map(([n, label]) => ({ name: n, label, path: path.join(dir, n), exists: util.exists(path.join(dir, n)) }));
}

module.exports = {
  readNBT, readLevelDat, listSaves, saveSize, previewIcon, deleteSave, renameSave,
  backupSave, listBackups, importSave, browse, diskInfo, deleteEntry, createFolder,
  quickFolders, savesDir, backupsDir
};