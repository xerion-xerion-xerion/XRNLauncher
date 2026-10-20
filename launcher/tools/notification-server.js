/*  Le point d entree des notifications du launcher.

    Deux choses, et rien d autre :
      - il renvoie le message a afficher (fichier notification-message.json) ;
      - il note chaque installation qui vient le voir.

    Aucune dependance : node notification-server.js [port]

    Pour l exposer sur internet, le plus simple est un Worker Cloudflare
    (le fichier worker.js de ce dossier, a coller dans l editeur de
    Cloudflare), ou un tunnel vers cette machine.                            */

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2] || 8788);
const racine = __dirname;
const fichierMessage = path.join(racine, 'notification-message.json');
const fichierJournal = path.join(racine, 'registrations.log');

/*  Le message par defaut : il ne s affiche que si le fichier existe
    et contient un identifiant.                                        */
function message() {
  try {
    const m = JSON.parse(fs.readFileSync(fichierMessage, 'utf8'));
    if (m && m.id) return m;
  } catch (e) { }
  return null;
}

function noter(req, url) {
  const id = url.searchParams.get('id') || '';
  const version = url.searchParams.get('v') || '';
  const ligne = JSON.stringify({
    quand: new Date().toISOString(),
    id: id,
    version: version,
    ip: (req.socket.remoteAddress || '').replace(/^::ffff:/, '')
  }) + '\n';
  try { fs.appendFileSync(fichierJournal, ligne); } catch (e) { }
}

const serveur = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (url.pathname === '/notification.json') {
    noter(req, url);
    const m = message();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(m || { id: '' }));
    return;
  }

  if (url.pathname === '/registrations') {
    let contenu = '';
    try { contenu = fs.readFileSync(fichierJournal, 'utf8'); } catch (e) { }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(contenu);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
});

serveur.listen(port, '0.0.0.0', () => {
  console.log('  serveur de notifications sur http://127.0.0.1:' + port);
  console.log('  message   : ' + fichierMessage);
  console.log('  journal   : ' + fichierJournal);
});
