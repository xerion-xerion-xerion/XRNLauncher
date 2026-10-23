'use strict';
/*  lib/manifeste.js — verification de l'etat local de l'installation.
 *
 *  Le launcher publie, a cote de l'archive, un manifeste : la liste des
 *  fichiers de l'application avec leur empreinte SHA-256, la version du
 *  runtime, et l'etat de la version precedente.
 *
 *  Au moment de proposer une mise a jour, on compare cet etat au
 *  disque. Si tout correspond, le patch suffit : on ne telecharge que
 *  les fichiers modifies. Sinon, on reprend l'archive complete.
 *
 *  La comparaison se fait sur les fichiers eux-memes, et non sur un
 *  manifeste local : les installations anterieures a cette notion
 *  restent compatibles, et rien n'a a etre signale a l'utilisateur. */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

/**
 * Le dossier d'installation : la ou sont poses les fichiers du
 * launcher. Distinct du dossier de donnees utilisateur, qui contient
 * les reglages et les sauvegardes.
 */
function dossierInstall() {
  try { return path.dirname(process.execPath); } catch (e) { return process.cwd(); }
}

/**
 * Empreinte SHA-256 d'un fichier, en hexadecimal.
 *
 * La lecture se fait par blocs : l'executable fait quelques Mo, et on
 * ne veut pas le charger entierement en memoire.
 */
function sha256Fichier(f) {
  try {
    const h = crypto.createHash('sha256');
    const fd = fs.openSync(f, 'r');
    try {
      const tampon = Buffer.allocUnsafe(64 * 1024);
      let n = 0;
      while ((n = fs.readSync(fd, tampon, 0, tampon.length, null)) > 0) {
        h.update(tampon.subarray(0, n));
      }
    } finally { fs.closeSync(fd); }
    return h.digest('hex');
  } catch (e) { return ''; }
}

/**
 * Version du runtime NW.js installe, lue dans nw.dll.
 *
 * Elle compte dans la decision : si le runtime a change, il faut
 * retelecharger 300 Mo, et le patch ne suffit pas. La version est dans
 * les ressources du fichier ; la lire demande un appel a PowerShell,
 * d'ou le fait de la demander en dernier.
 */
function versionRuntime(dossier) {
  try {
    const dll = path.join(dossier || dossierInstall(), 'nw.dll');
    if (!fs.existsSync(dll)) return '';
    const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      "(Get-Item -LiteralPath '" + dll.replace(/'/g, "''") + "').VersionInfo.FileVersion"],
      { encoding: 'utf8', windowsHide: true, timeout: 20000 });
    const v = String((r && r.stdout) || '').trim();
    return v ? v.split(/\s+/)[0] : '';
  } catch (e) { return ''; }
}

/**
 * Le manifeste de l'installation locale, s'il existe.
 *
 * Il ne sert qu'au diagnostic : la compatibilite du patch se verifie
 * sur les fichiers eux-memes, pour que les installations anterieures a
 * cette notion restent compatibles.
 */
function manifesteLocal(dossier) {
  try {
    const p = path.join(dossier || dossierInstall(), 'tools', 'manifest.json');
    const m = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (m && m.fichiers) ? m : null;
  } catch (e) { return null; }
}

/**
 * Le patch est-il applicable a cette installation ?
 *
 * Le manifeste publie contient "precedents" : l'etat de la version
 * installee, fichier par fichier, avec les empreintes. Si le disque
 * correspond exactement, et que le runtime n'a pas change, on ne
 * telecharge que les fichiers modifies. Sinon on reprend l'archive
 * complete : mieux vaut retelecharger que laisser un melange de deux
 * versions.
 *
 * Renvoie un objet { ok, raison } : la raison sert au journal, pour
 * savoir pourquoi le patch a ete refuse.
 */
function etatLocalCompatible(manifeste, dossier) {
  const racine = dossier || dossierInstall();
  try {
    if (!manifeste || !manifeste.precedents || !manifeste.runtimePrecedent) {
      return { ok: false, raison: 'manifeste incomplet' };
    }

    /*  Les fichiers de l'application : ils doivent etre la, et
        inchanges. C'est le controle le plus utile, et le moins cher. */
    /*  Les mods integres sont exclus : ce sont des livrables, pas
        l etat du launcher. Le jar y est remplace par chaque mise a
        jour qui le porte, et un refus ici bloquerait le patch pour
        toujours.                                                                   */
    for (const chemin of Object.keys(manifeste.precedents)) {
      if (/^mods-integres\//.test(chemin)) continue;
      const f = path.join(racine, chemin.replace(/\//g, path.sep));
      if (!fs.existsSync(f)) return { ok: false, raison: 'fichier absent : ' + chemin };
      if (sha256Fichier(f) !== String(manifeste.precedents[chemin])) {
        return { ok: false, raison: 'fichier modifie : ' + chemin };
      }
    }

    /*  L'executable porte l'icone : il compte dans l'etat. */
    if (manifeste.exePrecedent) {
      const exe = path.join(racine, 'XRNLauncher.exe');
      if (sha256Fichier(exe) !== String(manifeste.exePrecedent)) {
        return { ok: false, raison: 'executable different' };
      }
    }

    /*  Le runtime : s'il a change, le patch ne suffit pas. Ce
        controle est le plus lent, on le fait en dernier. */
    const runtime = versionRuntime(racine);
    if (runtime !== String(manifeste.runtimePrecedent)) {
      return { ok: false, raison: 'runtime ' + (runtime || '?') + ' au lieu de ' + manifeste.runtimePrecedent };
    }

    return { ok: true, raison: 'installation compatible' };
  } catch (e) {
    return { ok: false, raison: 'erreur : ' + (e && e.message ? e.message : e) };
  }
}

module.exports = { dossierInstall, sha256Fichier, versionRuntime, manifesteLocal, etatLocalCompatible };
