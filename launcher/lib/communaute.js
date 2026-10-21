'use strict';
/*  lib/communaute.js — l'annuaire des pseudos de la communaute.
 *
 *  Le client montre un logo a cote du pseudo des joueurs qui
 *  utilisent le meme launcher. Pour que ce logo apparaisse chez
 *  tout le monde, la liste des pseudos doit etre partagee : c'est le
 *  role de l'annuaire, heberge cote serveur.
 *
 *  Ce qui sort d'ici est strictement public : un pseudo de jeu. Ni
 *  identifiant de compte, ni jeton, ni adresse, ni historique. Un
 *  pseudo est la seule information publique d'un joueur de Minecraft,
 *  et c'est exactement ce qu'on cherche a afficher.
 *
 *  Le launcher s'inscrit lui-meme a l'annuaire au demarrage : sa
 *  presence fait gagner le logo aux autres joueurs de la communaute.
 */

const fs = require('fs');
const path = require('path');

const util = require('./util');
const http = require('./http');

/*  L'adresse du service. Elle vient du fichier de configuration du
 *  launcher, comme celle des notifications : une seule source.       */
function base() {
  try {
    const cfg = require('./config').load();
    return String(cfg.serviceUrl || '').replace(/\/+$/, '');
  } catch (e) { return ''; }
}

/** Le fichier ou la liste est ecrite, pour que le mod la lise. */
function fichierListe() {
  return path.join(util.appRoot(), 'communaute.json');
}

/**
 * La liste des pseudos connus, telle qu'elle est sur le disque.
 * Le mod la lit au demarrage : meme sans reseau, le jeu demarre.
 */
function listeLocale() {
  try {
    const m = JSON.parse(fs.readFileSync(fichierListe(), 'utf8'));
    return Array.isArray(m.pseudos) ? m.pseudos.map(String) : [];
  } catch (e) { return []; }
}

/** Ecrit la liste sur le disque, pour le mod. */
function ecrireListe(pseudos) {
  try {
    util.ensureDir(util.appRoot());
    fs.writeFileSync(fichierListe(), JSON.stringify({
      pseudos: pseudos,
      misAJour: new Date().toISOString()
    }), 'utf8');
    return true;
  } catch (e) { return false; }
}

/**
 * Va chercher l'annuaire et ecrit la liste.
 *
 * On garde la liste precedente si le reseau ne repond pas : mieux
 * vaut un annuaire d'il y a une heure qu'un annuaire vide.
 */
async function rafraichir(pseudo) {
  const url = base();
  if (!url) return { ok: false, detail: 'service non configure' };
  try {
    /*  D'abord on s inscrit, si on a un pseudo : c'est ce qui fait
        apparaitre le logo de ce joueur chez les autres.               */
    if (pseudo) {
      try {
        await http.postJSON(url + '/communaute', { pseudo: String(pseudo).slice(0, 16) });
      } catch (e) { /*  l inscription peut echouer sans consequence */ }
    }
    const r = await http.getJSON(url + '/communaute');
    const pseudos = (r && Array.isArray(r.pseudos)) ? r.pseudos.map(String) : [];
    if (!pseudos.length) return { ok: false, detail: 'annuaire vide' };
    ecrireListe(pseudos);
    return { ok: true, pseudos: pseudos, total: pseudos.length };
  } catch (e) {
    return { ok: false, detail: String(e && e.message ? e.message : e) };
  }
}

/**
 * Ajoute des pseudos a la liste locale, sans toucher au serveur.
 * C'est le filet de securite : si l annuaire est hors ligne, le
 * joueur peut quand meme declarer ceux qu il connait.
 */
function ajouter(pseudos) {
  const liste = new Set(listeLocale().map(s => s.toLowerCase()));
  const ajoute = [];
  for (const p of (pseudos || [])) {
    const n = String(p || '').trim().slice(0, 16);
    if (!n) continue;
    if (!liste.has(n.toLowerCase())) { liste.add(n.toLowerCase()); ajoute.push(n); }
  }
  if (!ajoute.length) return { ok: true, total: liste.size, ajoutes: [] };
  ecrireListe(Array.from(liste));
  return { ok: true, total: liste.size, ajoutes: ajoute };
}

module.exports = { base, fichierListe, listeLocale, ecrireListe, rafraichir, ajouter };
