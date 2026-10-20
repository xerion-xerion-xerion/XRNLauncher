/*  Les notifications envoyees par l auteur du launcher.

    L application interroge un point d entree chez l auteur. Ce point
    d entree lui renvoie le message a afficher, et enregistre au passage
    que l installation existe.

    Ce qui part sur le reseau, et rien d autre :
      - un identifiant anonyme, tire au sort au premier lancement et
        conserve sur le poste. Il ne relie a aucune donnee personnelle.
      - la version du launcher.
    Ni pseudo, ni gamertag, ni nom de machine, ni liste des versions
    installees. Le serveur voit l adresse IP de la requete, comme
    n importe quel serveur web.

    Le message porte un identifiant : on ne le montre qu une fois, et
    seulement s il change. Une notification de plus ne revient donc pas
    a chaque lancement.                                                */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('./http');
const util = require('./util');

/*  La configuration livree avec l application. Elle est cherchee
    d abord dans le dossier de l application (c est la que le build la
    depose), puis dans les donnees de l utilisateur : on peut ainsi
    changer l adresse du point d entree sans reconstruire.          */
function config() {
  const chemins = [
    path.join(__dirname, '..', 'notification.json'),
    path.join(util.appRoot(), 'notification.json')
  ];
  for (const p of chemins) {
    try {
      const c = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (c && c.url) return c;
    } catch (e) { }
  }
  return {};
}

/*  Un identifiant anonyme, tire une fois et conserve sur le poste. */
function idInstallation() {
  const fichier = path.join(util.appRoot(), 'notification-id.txt');
  try {
    const v = fs.readFileSync(fichier, 'utf8').trim();
    if (v) return v;
  } catch (e) { }
  const id = crypto.randomBytes(16).toString('hex');
  try { fs.writeFileSync(fichier, id, 'utf8'); } catch (e) { }
  return id;
}

/*  Le message a montrer, ou null. */
async function verifier() {
  const cfg = config();
  if (!cfg.active || !cfg.url) return null;

  const version = versionLauncher();
  const id = idInstallation();
  const url = cfg.url + (cfg.url.indexOf('?') >= 0 ? '&' : '?')
    + 'id=' + encodeURIComponent(id) + '&v=' + encodeURIComponent(version);

  let r = null;
  try {
    r = await http.getJSON(url, { timeout: 12000 });
  } catch (e) {
    /*  Pas de reseau, pas de message : on ne dit rien du tout. */
    return null;
  }
  if (!r || !r.id) return null;

  /*  Deja montre ? On ne le remontre pas. */
  const vu = path.join(util.appRoot(), 'notification-vue.txt');
  try {
    if (fs.readFileSync(vu, 'utf8').trim() === String(r.id)) return null;
  } catch (e) { }

  return r;
}

/*  On note que le message a ete montre. */
function marquerVue(id) {
  try {
    fs.writeFileSync(path.join(util.appRoot(), 'notification-vue.txt'), String(id), 'utf8');
  } catch (e) { }
}

/*  La version du launcher, lue dans le manifest de l application. */
function versionLauncher() {
  try {
    const racines = [path.join(__dirname, '..'), path.join(__dirname, '..', '..')];
    for (const r of racines) {
      const pj = JSON.parse(fs.readFileSync(path.join(r, 'package.json'), 'utf8'));
      if (pj && pj.version) return String(pj.version);
    }
  } catch (e) { }
  return '0.0.0';
}

module.exports = { config, idInstallation, verifier, marquerVue, versionLauncher };
