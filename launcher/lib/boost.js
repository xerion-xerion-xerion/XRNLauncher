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
const OPTIONS_JVM = [];

/**
 * Les options de JVM a ajouter, selon le mode.
 *
 * @param {boolean} actif  le mode boost est-il demande ?
 * @param {string} javaArgs les arguments deja choisis par le joueur
 * @param {number} ramGo   la memoire allouee, en Go
 * @returns {string[]} les arguments a ajouter
 */
function optionsJVM() {
  // Keep Minecraft's own JVM defaults. A rendering preset is not a GC preset.
  return [];
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
