'use strict';

/*  Detection de la musique en cours de lecture.
 *
 *  Sous Windows, tous les lecteurs (Spotify, Deezer, et tout ce qui
 *  s'inscrit dans le System Media Transport Controls) passent par la
 *  meme API. Un petit programme l'interroge et ecrit le resultat dans
 *  un fichier JSON ; le mod lit ce fichier.
 *
 *  Un fichier plutot qu'un port ouvert : le jeu n'a ainsi rien a
 *  demarrer, et rien ne tourne quand le jeu est ferme.
 *
 *  Sous Linux et macOS, rien n'est lance : le mod affiche simplement
 *  qu'aucune source n'est disponible.                                */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const util = require('./util');

let processus = null;

/** Le fichier ou le detecteur ecrit l'etat de la lecture. */
function fichierMedia() {
  return path.join(util.appRoot(), 'media.json');
}

/** La pochette, a cote du fichier d'etat. */
function fichierPochette() {
  return path.join(util.appRoot(), 'media.png');
}

/*  Le dossier de l'application, trouve par le module lui-meme : ca
    marche que le launcher soit lance depuis son dossier ou depuis un
    raccourci.                                                        */
function dossierOutils() {
  return path.join(__dirname, '..', 'tools');
}

/**
 * Demarre la detection, si la plateforme et les fichiers le permettent.
 * Sans effet sur Linux et macOS, ou si le detecteur a disparu.
 */
function demarrer(ownerPid) {
  if (process.platform !== 'win32') return false;
  if (processus) return true;

  const exe = path.join(dossierOutils(), 'XrnMedia.exe');
  const script = path.join(dossierOutils(), 'media-session.ps1');
  const arguments_ = [fichierMedia(), fichierPochette(), String(ownerPid || 0)];

  try {
    if (fs.existsSync(exe)) {
      /*  Le programme ecrit aussi la pochette, en PNG. */
      processus = spawn(exe, arguments_, { stdio: 'ignore', windowsHide: true });
    } else if (fs.existsSync(script)) {
      /*  Repli : le script fait la meme chose, sans la pochette. */
      processus = spawn('powershell', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', script, '-Fichier', arguments_[0]
      ], { stdio: 'ignore', windowsHide: true });
    } else {
      return false;
    }
    const current = processus;
    current.once('exit', () => { if (processus === current) processus = null; });
    processus.unref();
    processus.on('error', () => { processus = null; });
    return true;
  } catch (e) {
    processus = null;
    return false;
  }
}

/** Arrete la detection. */
function arreter() {
  if (!processus) return;
  try { processus.kill(); } catch (e) { }
  processus = null;
}

function detacher() { if (processus) processus.unref(); }
module.exports = { demarrer, arreter, detacher, fichierMedia, fichierPochette };
