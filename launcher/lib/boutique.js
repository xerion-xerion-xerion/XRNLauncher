'use strict';
/*  lib/boutique.js — le catalogue et les droits du joueur.
 *
 *  La boutique est hebergee : le catalogue, les codes d'activation et
 *  les droits acquis sont sur le serveur. Le launcher ne fait que
 *  lire et demander ; il ne decide rien.
 *
 *  Un droit est une chaine : "cape_aurora", "wings_lumiere"... Le mod
 *  sait les lire, et le lanceur sait les afficher.
 *
 *  Pour l'instant l'activation se fait par code. C'est le meme
 *  cheminement qu'un paiement : le serveur accorde le droit, jamais
 *  le client. Brancher un prestataire de paiement plus tard ne
 *  change rien a ce contrat.
 */

const fs = require('fs');
const path = require('path');

const util = require('./util');
const http = require('./http');
const communaute = require('./communaute');

/** Le fichier des droits, que le mod lit au demarrage. */
function fichierDroits() {
  return path.join(util.appRoot(), 'droits.json');
}

/** Les droits de l joueur, lus sur le disque. */
function droitsLocaux() {
  try {
    const m = JSON.parse(fs.readFileSync(fichierDroits(), 'utf8'));
    return Array.isArray(m.droits) ? m.droits.map(String) : [];
  } catch (e) { return []; }
}

function ecrireDroits(droits, etoiles) {
  try {
    util.ensureDir(util.appRoot());
    fs.writeFileSync(fichierDroits(), JSON.stringify({
      droits: Array.isArray(droits) ? droits : [],
      etoiles: Number(etoiles) || 0,
      misAJour: new Date().toISOString()
    }), 'utf8');
    return true;
  } catch (e) { return false; }
}

/**
 * Le catalogue, et les droits du joueur.
 * Renvoie { ok, produits, droits, etoiles, serie }.
 */
async function catalogue(pseudo) {
  const url = communaute.base();
  if (!url) return { ok: false, detail: 'service non configure', produits: [], droits: droitsLocaux(), etoiles: 0, serie: { jour: 0, streak: 0, prochainDans: 0 } };
  try {
    const q = pseudo ? '?pseudo=' + encodeURIComponent(String(pseudo).slice(0, 16)) : '';
    const r = await http.getJSON(url + '/boutique' + q);
    const produits = (r && Array.isArray(r.produits)) ? r.produits : [];
    const droits = (r && Array.isArray(r.droits)) ? r.droits : [];
    const etoiles = (r && Number(r.etoiles)) || 0;
    const serie = (r && r.serie) ? r.serie : { jour: 0, streak: 0, prochainDans: 0 };
    if (droits.length || etoiles) ecrireDroits(droits, etoiles);
    return { ok: true, produits: produits, droits: droits, etoiles: etoiles, serie: serie };
  } catch (e) {
    return { ok: false, detail: String(e && e.message ? e.message : e), produits: [], droits: droitsLocaux(), etoiles: 0, serie: { jour: 0, streak: 0, prochainDans: 0 } };
  }
}

/**
 * La recompense quotidienne.
 *
 * Le serveur garde la date du dernier retrait : on ne peut pas
 * reencaisser deux fois le meme jour. Une serie longue donne plus
 * d etoiles.
 */
async function recompense(pseudo) {
  const url = communaute.base();
  if (!url) return { ok: false, detail: 'service non configure' };
  if (!pseudo) return { ok: false, detail: 'aucun compte connecte' };
  try {
    const r = await http.getJSON(url + '/boutique/recompense?pseudo=' + encodeURIComponent(String(pseudo).slice(0, 16)));
    if (!r || !r.ok) return { ok: false, detail: (r && r.raison) ? r.raison : 'recompense indisponible' };
    ecrireDroits(droitsLocaux(), r.total || 0);
    return r;
  } catch (e) {
    return { ok: false, detail: String(e && e.message ? e.message : e) };
  }
}

/**
 * Active un code : le serveur accorde le droit, et nous renvoie la
 * liste a jour. C'est lui la source de verite.
 */
async function activer(pseudo, code) {
  const url = communaute.base();
  if (!url) return { ok: false, detail: 'service non configure' };
  if (!pseudo) return { ok: false, detail: 'aucun compte connecte' };
  if (!code) return { ok: false, detail: 'code vide' };
  try {
    const r = await http.postJSON(url + '/boutique', {
      pseudo: String(pseudo).slice(0, 16),
      code: String(code).trim().toUpperCase()
    });
    if (!r || !r.ok) {
      return { ok: false, detail: (r && r.raison) ? r.raison : 'activation refusee' };
    }
    const droits = Array.isArray(r.droits) ? r.droits : [];
    ecrireDroits(droits, 0);
    return { ok: true, produit: r.produit, droits: droits };
  } catch (e) {
    return { ok: false, detail: String(e && e.message ? e.message : e) };
  }
}

module.exports = { fichierDroits, droitsLocaux, ecrireDroits, catalogue, activer, recompense };
