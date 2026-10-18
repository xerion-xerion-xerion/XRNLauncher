'use strict';
/*  lib/skins.js — trouver la skin réellement équipée d'un pseudo.

    La piste normale est le profil Minecraft obtenu a la connexion, qui
    contient deja l'URL de la skin. Mais elle n'existe que si l'echange
    est passe par les services Mojang — donc pas en mode solo, ni en
    mode Xbox.

    Il existe pourtant une voie officielle, sans aucune authentification :
    Mojang expose le profil public d'un joueur a partir de son seul nom.
    C'est ce qui permet d'afficher la vraie skin d'un profil solo, sans
    jamais avoir besoin de l'approbation Mojang ni d'un service tiers.

    Deux pieges rencontres la :
      - les URL de texture sont encore renvoyees en http:// ; sans
        passage en https la requete echoue entierement ;
      - la skin peut etre au format 64x64 ou 64x32 selon son anciennete.
        La region de la tete est identique dans les deux, donc le rendu
        n'a pas a s'en soucier.                                          */

const http = require('./http');

const URL_NOM  = 'https://api.mojang.com/users/profiles/minecraft/';
const URL_PROFIL = 'https://sessionserver.mojang.com/session/minecraft/profile/';

/*  Le nom est stable : une skin change rarement, et un appel reseau a
    chaque affichage ferait ramer l'interface. On memorise le resultat,
    y compris quand il est vide.                                       */
const cache = new Map();
const DUREE = 30 * 60 * 1000;      // 30 minutes
const DUREE_ABSENTE = 10 * 60 * 1000;  // 10 minutes si le nom est inconnu

async function parNom(nom) {
  const cle = String(nom || '').trim().toLowerCase();
  if (!cle) return '';

  const vu = cache.get(cle);
  if (vu && Date.now() - vu.t < (vu.url ? DUREE : DUREE_ABSENTE)) return vu.url;

  let url = '';
  try {
    /*  1. le pseudo existe-t-il chez Mojang ?                        */
    const p = await http.getJSON(URL_NOM + encodeURIComponent(cle));
    if (!p || !p.id) { cache.set(cle, { t: Date.now(), url: '' }); return ''; }

    /*  2. le profil public contient-il la skin ?                     */
    const s = await http.getJSON(URL_PROFIL + String(p.id).replace(/-/g, ''));
    const tex = (s && s.properties || []).find(x => x.name === 'textures');
    if (tex && tex.value) {
      const decode = JSON.parse(Buffer.from(tex.value, 'base64').toString('utf8'));
      const trouve = decode && decode.textures && decode.textures.SKIN && decode.textures.SKIN.url;
      if (trouve) {
        url = String(trouve);
        if (url.slice(0, 7) === 'http://') url = url.replace(/^http:\/\//, 'https://');
      }
    }
  } catch (e) {
    /*  Pseudo inconnu (404), pas de reseau, quota epuise, panne : on
        garde ce qu'on a. Un avatar manquant vaut mieux qu'un avatar qui
        fait planter l'onglet.                                          */
  }

  cache.set(cle, { t: Date.now(), url });
  return url;
}

/*  Vide le cache, pour forcer un rafraichissement apres un changement
    de skin cote joueur.                                                 */
function vider() { cache.clear(); }

module.exports = { parNom, vider };