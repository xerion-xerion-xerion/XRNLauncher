'use strict';
/*  lib/util.js — chemins, fichiers, formats, petits utilitaires  */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFile } = require('child_process');

const APP_NAME = 'XRNLauncher';

function appRoot() {
  return path.join(process.env.APPDATA || os.homedir(), APP_NAME);
}
function ensureDir(p) {
  if (!p) return p;
  try { fs.mkdirSync(p, { recursive: true }); } catch (e) { /* deja present */ }
  return p;
}
function exists(p) {
  try { fs.accessSync(p); return true; } catch (e) { return false; }
}
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(file, obj) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function human(n) {
  n = Number(n) || 0;
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i === 0 ? n : n.toFixed(n < 10 ? 1 : 0)) + ' ' + u[i];
}
function humanTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min ' + (s % 60) + ' s';
  return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}
function humanDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '—';
  const p = n => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function relative(ts) {
  if (!ts) return 'jamais';
  const diff = Date.now() - Number(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "a l'instant";
  if (m < 60) return 'il y a ' + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return 'il y a ' + h + ' h';
  const d = Math.floor(h / 24);
  if (d < 30) return 'il y a ' + d + ' j';
  return humanDate(ts);
}

/*  Mesurer un dossier demande un stat par fichier : sur "assets" et
    "libraries" cela represente plusieurs milliers d'appels et plus d'une
    seconde. Or ces dossiers sont mesures en boucle, a chaque changement
    d'onglet. On garde donc le resultat quelques secondes.

    Le cache est invalide a l'installation d'une version, et par
    viderTailles() apres toute operation qui change le contenu.          */
const cacheTailles = new Map();
const DUREE_TAILLE = 20000;

function dirSize(p) {
  const maintenant = Date.now();
  const hit = cacheTailles.get(p);
  if (hit && maintenant - hit.t < DUREE_TAILLE) return hit.v;

  let total = 0, files = 0;
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else {
        try { total += fs.statSync(full).size; files++; } catch (err) { /* ignore */ }
      }
    }
  })(p);
  const resultat = { size: total, files };
  cacheTailles.set(p, { t: maintenant, v: resultat });
  return resultat;
}

/*  A appeler apres un telechargement, une suppression ou une importation :
      les tailles affichees seraient sinon restees fausses.             */
function viderTailles() { cacheTailles.clear(); }

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); return true; } catch (e) { return false; }
}

async function listDirAsync(dir) {
  const entries = await fs.promises.readdir(dir, {withFileTypes:true});
  const result = [];
  for (let i = 0; i < entries.length; i += 24) {
    const batch = await Promise.all(entries.slice(i, i+24).map(async e => {
      const full = path.join(dir, e.name);
      try { const st = await fs.promises.stat(full); return {name:e.name,path:full,dir:e.isDirectory(),size:e.isDirectory()?0:st.size,mtime:st.mtimeMs}; }
      catch (_) { return null; }
    }));
    result.push(...batch.filter(Boolean));
  }
  return result.sort((a,b)=>(b.dir-a.dir)||a.name.localeCompare(b.name,'fr',{numeric:true}));
}

function listDir(dir, opts) {
  opts = opts || {};
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    let st = null;
    try { st = fs.statSync(full); } catch (err) { continue; }
    out.push({
      name: e.name,
      path: full,
      dir: e.isDirectory(),
      size: e.isDirectory() ? (opts.withSize ? dirSize(full).size : 0) : st.size,
      mtime: st.mtimeMs
    });
  }
  out.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, 'fr', { numeric: true }));
  return out;
}

/* Lance un processus court et renvoie { code, stdout, stderr } */
/*  Lance un processus court et renvoie { code, stdout, stderr }.
    Cette fonction ne rejette jamais : un binaire qui n'existe pas, un
    fichier qui n'est pas un executable ou un echec de demarrage
    doivent se traduire par un code d'erreur, jamais par une exception.
    Une seule exception ici suffisait a faire echouer la detection de
    Java dans son ensemble, et donc a afficher "Java manquant" alors
    qu'un Java valide existait.                                         */
function run(cmd, args, timeoutMs) {
  return new Promise(resolve => {
    let reponse = { code: 1, stdout: '', stderr: '', error: null };
    try {
      execFile(cmd, args, { windowsHide: true, timeout: timeoutMs || 20000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          reponse.code = (typeof err.code === 'number' && err.code !== 0) ? err.code : 1;
          reponse.error = err.message;
        } else {
          reponse.code = 0;
        }
        reponse.stdout = String(stdout || '');
        reponse.stderr = String(stderr || '');
        resolve(reponse);
      });
    } catch (e) {
      reponse.code = 1;
      reponse.error = (e && e.message) || String(e);
      resolve(reponse);
    }
  });
}

/* Ouvre un dossier / selectionne un fichier dans l'explorateur Windows */
function openExplorer(target, select) {
  const args = select ? ['/select,' + target] : [target];
  require('child_process').spawn('explorer.exe', args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  return true;
}

/* Ouvre une URL dans le navigateur par defaut */
function openUrl(url) {
  const parsed=new URL(String(url));
  if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('Adresse web refusée');
  require('child_process').spawn('explorer.exe', [parsed.href], {
    detached: true, stdio: 'ignore', windowsHide: true
  }).unref();
  return true;
}

/* ------------------------------------------------------------------ */
/*  Extraction d'un fichier zip                                         */
/* ------------------------------------------------------------------ */
/*  Les bibliotheques natives de Minecraft sont des fichiers .jar, donc
    des zip. L'extraction se fait ici, en Node, plutot que via
    PowerShell : la surcharge "ExtractToDirectory(source, destination,
    ecraser)" n'existe pas dans .NET Framework, qui est pourtant la
    version utilisee par le PowerShell de Windows. L'appel echouait
    silencieusement et les natives n'etaient jamais extraits : le jeu
    ne pouvait pas demarrer.                                            */
function extractZip(archive, dest) {
  const buf = fs.readFileSync(archive);

  /*  fin du repertoire central */
  let eocd = -1;
  const debut = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= debut; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Archive zip illisible : ' + archive);

  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);

  ensureDir(dest);
  const racine = path.resolve(dest);
  let ecrits = 0;

  for (let n = 0; n < total; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
    const methode       = buf.readUInt16LE(off + 10);
    const tailleComp    = buf.readUInt32LE(off + 20);
    const nomLen        = buf.readUInt16LE(off + 28);
    const extraLen      = buf.readUInt16LE(off + 30);
    const commentaireLen = buf.readUInt16LE(off + 32);
    const offsetLocal   = buf.readUInt32LE(off + 42);
    const nom = buf.slice(off + 46, off + 46 + nomLen).toString('utf8');
    off += 46 + nomLen + extraLen + commentaireLen;

    if (!nom || nom.charAt(nom.length - 1) === '/') continue;

    const cible = path.resolve(path.join(dest, nom));
    if (cible !== racine && cible.indexOf(racine + path.sep) !== 0) continue;  // traversée refusée

    const nomLenLocal   = buf.readUInt16LE(offsetLocal + 26);
    const extraLenLocal = buf.readUInt16LE(offsetLocal + 28);
    const debutDonnees  = offsetLocal + 30 + nomLenLocal + extraLenLocal;
    const brut = buf.slice(debutDonnees, debutDonnees + tailleComp);

    let contenu;
    if (methode === 0) contenu = brut;
    else if (methode === 8) contenu = zlib.inflateRawSync(brut);
    else throw new Error('Methode de compression zip non geree : ' + methode);

    ensureDir(path.dirname(cible));
    fs.writeFileSync(cible, contenu);
    ecrits++;
  }
  return ecrits;
}

/* Copie recursive (utilisee par les imports de saves) */
function copyDir(src, dst) {
  ensureDir(dst);
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

module.exports = {
  APP_NAME, appRoot, ensureDir, exists, readJSON, writeJSON,
  human, humanTime, humanDate, relative,
  dirSize, viderTailles, rmrf, listDir, listDirAsync, run, openExplorer, openUrl, copyDir, extractZip
};
