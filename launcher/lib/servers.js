'use strict';
/*  lib/servers.js — statut reel d'un serveur Minecraft (protocole "status")
                      handshake + status request + ping                     */

const net   = require('net');
const util  = require('./util');

function varint(value) {
  const bytes = [];
  let v = value >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function mcString(str) {
  const b = Buffer.from(str, 'utf8');
  const out = Buffer.alloc(3 + b.length);
  out.writeUInt16BE(b.length, 0);
  b.copy(out, 3);
  return out;
}

function packet(id, payload) {
  const body = Buffer.concat([varint(id), payload]);
  return Buffer.concat([varint(body.length), body]);
}

function readVarint(buf, offset) {
  let numRead = 0, result = 0, byte;
  do {
    if (offset + numRead >= buf.length) throw new Error('paquet tronque');
    byte = buf.readUInt8(offset + numRead);
    result |= (byte & 0x7f) << (7 * numRead);
    numRead++;
    if (numRead > 5) throw new Error('varint invalide');
  } while (byte & 0x80);
  return { value: result >>> 0, size: numRead };
}

/* Etape 1+2 : recuperation du statut (motd, joueurs, version) */
function status(host, port) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let done = false, buffer = Buffer.alloc(0);
    const started = Date.now();
    const finish = (err, data) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch (e) {}
      err ? reject(err) : resolve(data);
    };
    sock.setTimeout(8000);
    sock.on('timeout', () => finish(new Error('Delai depasse')));
    sock.on('error', e => finish(new Error(e.code === 'ECONNREFUSED' ? 'Connexion refusee' : (e.code || e.message))));
    sock.on('close', () => finish(new Error('Serveur ferme la connexion')));
    sock.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        if (buffer.length < 3) return;
        const len = readVarint(buffer, 0);
        const total = len.size + len.value;
        if (buffer.length < total) return;
        const id = readVarint(buffer, len.size);
        if (id.value !== 0x00) return finish(new Error('reponse inattendue'));
        const strLen = readVarint(buffer, len.size + id.size);
        const start = len.size + id.size + strLen.size;
        const json = buffer.toString('utf8', start, start + strLen.value);
        const data = JSON.parse(json);

        // etape 3 : ping/pong pour la latence reelle
        const pingPacket = packet(0x01, Buffer.alloc(8));
        sock.write(pingPacket);
        const t0 = Date.now();
        const onPong = buf => {
          try {
            if (buf.length < 2) return;
            const l = readVarint(buf, 0);
            if (buf.length < l.size + l.value) return;
            sock.removeListener('data', onPong);
            finish(null, {
              host, port,
              online: true,
              version: data.version && (data.version.name || data.version.protocol),
              protocol: data.version ? data.version.protocol : null,
              players: data.players ? data.players.online : 0,
              maxPlayers: data.players ? data.players.max : 0,
              description: typeof data.description === 'string' ? data.description : (data.description && data.description.text) || '',
              favicon: data.favicon || '',
              latency: Math.max(1, Date.now() - t0),
              handshake: Date.now() - started
            });
          } catch (e) { /* ignore */ }
        };
        sock.on('data', onPong);
        setTimeout(() => finish(null, {
          host, port, online: true,
          version: data.version && data.version.name,
          players: data.players ? data.players.online : 0,
          maxPlayers: data.players ? data.players.max : 0,
          description: typeof data.description === 'string' ? data.description : '',
          favicon: data.favicon || '',
          latency: Date.now() - started
        }), 2500);
      } catch (e) { finish(new Error('Protocole invalide : ' + e.message)); }
    });
    sock.connect(port, host, () => {
      const handshake = packet(0x00, Buffer.concat([
        varint(767),                       // version de protocole (1.21.x)
        mcString(host),
        Buffer.from([(port >> 8) & 0xff, port & 0xff]),
        varint(1)
      ]));
      const req = packet(0x00, Buffer.alloc(0));
      sock.write(Buffer.concat([handshake, req]));
    });
  });
}

/* Serveurs enregistres par l'utilisateur */
function serverFile() { return require('path').join(require('./util').appRoot(), 'servers.json'); }

function loadServers() { return util.readJSON(serverFile(), []); }
function saveServers(list) { util.writeJSON(serverFile(), list || []); }

function addServer(host, port, name) {
  const list = loadServers();
  if (list.some(s => s.host === host && s.port === port)) return list;
  list.push({ host, port: Number(port) || 25565, name: name || (host + ':' + (port || 25565)) });
  saveServers(list);
  return list;
}
function removeServer(host, port) {
  const list = loadServers().filter(s => !(s.host === host && s.port === Number(port)));
  saveServers(list);
  return list;
}

module.exports = { status, loadServers, saveServers, addServer, removeServer, serverFile };