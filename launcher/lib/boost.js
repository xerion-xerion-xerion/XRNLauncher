'use strict';
/*  lib/boost.js — le mode « Boost FPS ».
 *
 *  Un boost d'images par seconde, ce n'est pas de la magie : c'est
 *  une liste de leviers tires dans le bon sens. Le gain depend de la
 *  carte graphique et de la scene ; le mode ne promet pas un chiffre,
 *  il applique un profil.
 *
 *  Ce que fait le mode :
 *
 *    - des options de reglages JVM adaptes au jeu (GC, pauses courtes,
 *      desactivation du GC explicite) ;
 *    - une memoire de depart plus large, pour eviter les recopies ;
 *    - un profil graphique allégé applique par le mod au demarrage :
 *      distance d'affichage, distance de simulation, particules,
 *      nuages, moteur de lumiere, ombres, mipmapping, biome, anisotropie.
 *
 *  Ce que le mode ne fait pas : il ne touche ni au serveur, ni aux
 *  autres joueurs. Tout est local.
 */

const path = require('path');

/*  Les options de la JVM, pour un client de jeu.
    Elles sont employees par beaucoup de clients : le GC G1 avec des
    pauses courtes, pas de GC explicite, et un ratio de survie qui
    libere vite les objets jeunes.                                     */
const OPTIONS_JVM = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=30',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:+UseStringDeduplication',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
  '-XX:G1HeapWastePercent=5',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:InitiatingHeapOccupancyPercent=15',
  '-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem',
  '-XX:MaxTenuringThreshold=1',
  '-Dusing.aikars.flags=https://mcflags.emc.gs',
  '-Dfml.ignoreInvalidMinecraftCertificates=true',
  '-Dfml.ignoreJavaVersion=true'
];

/**
 * Les options de JVM a ajouter, selon le mode.
 *
 * @param {boolean} actif  le mode boost est-il demande ?
 * @param {string} javaArgs les arguments deja choisis par le joueur
 * @param {number} ramGo   la memoire allouee, en Go
 * @returns {string[]} les arguments a ajouter
 */
function optionsJVM(actif, javaArgs, ramGo) {
  const deja = String(javaArgs || '').trim();
  const out = [];
  if (!actif) return out;

  /*  On ne repete pas une option que le joueur a deja mise. */
  for (const o of OPTIONS_JVM) {
    if (deja.indexOf(o.split('=')[0]) >= 0) continue;
    out.push(o);
  }

  /*  Une memoire de depart egale a la memoire finale evite de
      recopier le tas au cours de la partie. On ne le fait que si le
      joueur n a pas impose de -Xmx lui-meme.                          */
  const mo = Math.max(1024, Math.round((Number(ramGo) || 4) * 1024));
  if (deja.indexOf('-Xms') < 0 && deja.indexOf('-Xmx') < 0) {
    out.push('-Xms' + mo + 'M');
  }
  return out;
}

/**
 * Ce que le mod doit appliquer au demarrage.
 * On passe un simple mot : le mod lit la liste par son propre code,
 * et sait revenir en arriere quand le mode est desactive.
 */
function optionMod(actif) {
  return actif ? '-DXRNBoostFps=1' : '-DXRNBoostFps=0';
}

module.exports = { OPTIONS_JVM, optionsJVM, optionMod };
