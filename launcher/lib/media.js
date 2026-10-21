'use strict';

/*  Detection de la musique en cours de lecture.
 *
 *  Sous Windows, tous les lecteurs (Spotify, Deezer, et tout ce qui
 *  s'inscrit dans le System Media Transport Controls) passent par la
 *  meme API. Un script PowerShell l'interroge et ecrit le resultat
 *  dans un fichier JSON ; le mod lit ce fichier.
 *
 *  Un fichier et non un port ouvert : le jeu n'a ainsi rien a
 *  demarrer, et rien ne tourne quand le jeu est ferme.
 *
 *  Sous Linux et macOS, rien n'est lance : le mod affiche simplement
 *  qu'aucune source n'est disponible.                                */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const util = require('./util');

let processus = null;

/** Le fichier ou le detecteur ecrit l'etat de la lecture. */
function fichierMedia() {
  return path.join(util.appRoot(), 'media.json');
}

/** Le script qui fait la detection, s'il est livre avec l'application. */
function script() {
  /*  Le dossier de l application, trouve par le module lui-meme :
      ca marche que le launcher soit lance depuis son dossier ou
      depuis un raccourci.                                             */
  const dossier = path.join(__dirname, '..', 'tools', 'media-session.ps1');
  if (fs.existsSync(dossier)) return dossier;
  return path.join(path.dirname(process.execPath), 'tools', 'media-session.ps1');
}

/**
 * Demarre la detection, si la plateforme et les fichiers le permettent.
 * Sans effet sur Linux et macOS, ou si le script a disparu.
 */
function demarrer() {
  if (process.platform !== 'win32') return false;
  if (processus) return true;
  const fichier = script();
  if (!fs.existsSync(fichier)) return false;

  const args = [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', fichier,
    '-Fichier', fichierMedia()
  ];
  try {
    /*  Pas de "detached" : sur cette version de node, un enfant
        detache ne demarre jamais.                                     */
    processus = spawn('powershell', args, { stdio: 'ignore', windowsHide: true });
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

module.exports = { demarrer, arreter, fichierMedia };
