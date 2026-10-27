'use strict';
/*  lib/http.js — requetes HTTPS avec redirection, telechargement en flux,
                   annulation, reprise (Range) et verification SHA-1          */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const util   = require('./util');

const UA = 'XRNLauncher/' + require('../package.json').version + ' (+https://github.com/xerion-xerion-xerion/XRNLauncher)';

/*  Agent a connexions persistantes.
    Sans cela, chaque requete ouvre une nouvelle connexion TCP et
    refait une poignee de main TLS. Sur une version recente de Minecraft
    cela represente plus de 5000 requetes pour les seules ressources :
    la connexion unique devient alors le goulot d'etrangle, bien avant
    la bande passante.                                                       */
const AGENTS = {
  https: new https.Agent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 20000 }),
  http:  new http.Agent({  keepAlive: true, maxSockets: 16, keepAliveMsecs: 20000 })
};
function agentPour(mod) { return mod === https ? AGENTS.https : AGENTS.http; }

/*  Token d'annulation simple, partage avec l'UI  */
function makeToken() {
  return { cancelled: false, paused: false, current: null, _waiters: [] };
}
function cancel(token) { if (token) { token.cancelled = true; token._waiters.forEach(w => w()); token._waiters.length = 0; } }
async function waitWhilePaused(token) {
  while (token.paused && !token.cancelled) {
    await new Promise(r => token._waiters.push(r));
  }
}

function rawRequest(url, options) {
  options = options || {};
  const parsed=new URL(url);
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('URL réseau refusée');
  const mod = parsed.protocol==='http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = mod.request(url, {
      method: options.method || 'GET',
      agent: agentPour(mod),
      headers: Object.assign({ 'User-Agent': UA }, options.headers || {})
    }, res => resolve({ res, req }));
    req.setTimeout(30000,()=>req.destroy(new Error('Délai réseau dépassé')));
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function request(url, options, depth) {
  depth = depth || 0;
  if (depth > 8) throw new Error('Trop de redirections');
  const { res, req } = await rawRequest(url, options);
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    res.resume();
    const next = new URL(res.headers.location, url).toString();
    const from=new URL(url),to=new URL(next);
    if(from.protocol==='https:'&&to.protocol!=='https:')throw new Error('Redirection HTTPS non sécurisée refusée');
    // Never forward an OAuth body, session token or authorization header to another origin.
    const sensitive=options&&(options.body||Object.keys(options.headers||{}).some(k=>/authorization|cookie/i.test(k)));
    if(from.origin!==to.origin&&sensitive)throw new Error('Redirection authentifiée vers un autre service refusée');
    return request(next, options, depth + 1);
  }
  return { res, req };
}

function readBody(res, limit) {
  return new Promise((resolve, reject) => {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', c => {
      data += c;
      if (limit && data.length > limit) { reject(new Error('Reponse trop volumineuse')); res.destroy(); }
    });
    res.on('end', () => resolve(data));
    res.on('error', reject);
  });
}

async function getJSON(url, options) {
  const { res } = await request(url, options);
  const body = await readBody(res, 64 * 1024 * 1024);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const err = new Error('HTTP ' + res.statusCode);
    err.status = res.statusCode; err.body = body;
    throw err;
  }
  try { return JSON.parse(body); } catch (e) { throw new Error('JSON invalide : ' + body.slice(0, 120)); }
}

/*  Encode un objet en application/x-www-form-urlencoded.
    Les endpoints OAuth2 de Microsoft (devicecode, token) ignorent un
    corps JSON : ils respondent AADSTS900144 si client_id est absent.  */
function formBody(payload) {
  return Object.keys(payload)
    .filter(k => payload[k] !== undefined && payload[k] !== null)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(payload[k]))
    .join('&');
}

async function postJSON(url, payload, extraHeaders, method) {
  const readOnly=/^(GET|HEAD)$/i.test(method||'POST');
  const body = readOnly ? undefined : (typeof payload === 'string' ? payload : JSON.stringify(payload));
  const { res } = await request(url, {
    method: method || 'POST',
    headers: Object.assign(readOnly ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, extraHeaders || {}),
    body
  });
  const text = await readBody(res, 4 * 1024 * 1024);
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.statusCode, json, text, headers:res.headers };
}

/*  Variante form-urlencodee : utilisee par l'OAuth Microsoft.         */
async function postForm(url, payload, extraHeaders, method) {
  const body = formBody(payload);
  const { res } = await request(url, {
    method: method || 'POST',
    headers: Object.assign({
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }, extraHeaders || {}),
    body
  });
  const text = await readBody(res, 4 * 1024 * 1024);
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: res.statusCode, json, text, headers:res.headers };
}

function hashFile(file,algorithm) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash(algorithm);
    const s = fs.createReadStream(file);
    s.on('data', d => h.update(d));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', reject);
  });
}

function sha1File(file){return hashFile(file,'sha1');}
function sha256File(file){return hashFile(file,'sha256');}

/*  Telecharge une URL vers `dest`.
    opts : { sha1, onProgress(done,total), token, verify, retries }          */
async function download(url, dest, opts) {
  opts = opts || {};
  const token = opts.token || makeToken();
  const retries = opts.retries == null ? 3 : opts.retries;
  let attempt = 0;

  util.ensureDir(path.dirname(dest));

  while (true) {
    attempt++;
    await waitWhilePaused(token);
    if (token.cancelled) { const e = new Error('Annule'); e.cancelled = true; throw e; }

    // si deja present et taille connue + verification possible -> rien a faire
    let existing = 0;
    try { existing = fs.statSync(dest).size; } catch (e) {}

    try {
      const headers = { Accept: '*/*' };
      if (existing > 0) headers.Range = 'bytes=' + existing + '-';
      const { res, req } = await request(url, { headers });
      token.current = req;

      if (res.statusCode === 416) { // deja complet
        res.resume();
        const algorithm=opts.sha256?'sha256':opts.sha1?'sha1':null;
        if(algorithm&&opts.verify!==false&&existing>0){
          const got=await hashFile(dest,algorithm);
          if(got.toLowerCase()===String(opts[algorithm]).toLowerCase())return {file:dest,skipped:true};
        }else if(existing>0&&res.headers['content-range']==='bytes */'+existing)return {file:dest,skipped:true};
        if(existing>0)fs.unlinkSync(dest);
        throw new Error('Fichier local incomplet ou corrompu');
      }
      if (res.statusCode >= 400) {
        res.resume();
        throw new Error('HTTP ' + res.statusCode);
      }
      const appending = res.statusCode === 206 && existing > 0;
      const lenHeader = res.headers['content-length'];
      const total = lenHeader ? (Number(lenHeader) + (appending ? existing : 0)) : 0;

      if (!appending) {
        util.ensureDir(path.dirname(dest));
        // ecriture directe : pas de fichier partiel
        const out = fs.createWriteStream(dest);
        await new Promise((resolve, reject) => {
          let done = appending ? existing : 0;
          res.on('data', c => {
            done += c.length;
            if (opts.onProgress) opts.onProgress(done, total);
          });
          res.on('error', reject);
          out.on('error', reject);
          out.on('finish', resolve);
          res.pipe(out);
        });
      } else {
        const out = fs.createWriteStream(dest, { flags: 'a' });
        await new Promise((resolve, reject) => {
          let done = existing;
          res.on('data', c => {
            done += c.length;
            if (opts.onProgress) opts.onProgress(done, total);
          });
          res.on('error', reject);
          out.on('error', reject);
          out.on('finish', resolve);
          res.pipe(out);
        });
      }
      token.current = null;

      // verification d'integrite
      if (opts.verify !== false && (opts.sha1||opts.sha256)) {
        const algorithm=opts.sha256?'sha256':'sha1';
        const got = await hashFile(dest,algorithm);
        if (got.toLowerCase() !== String(opts[algorithm]).toLowerCase()) {
          try { fs.unlinkSync(dest); } catch (e) {}
          throw new Error('Empreinte invalide (fichier corrompu)');
        }
      }
      return { file: dest, skipped: false };
    } catch (e) {
      token.current = null;
      if (e.cancelled || token.cancelled) throw e;
      if (attempt >= retries) throw new Error(e.message + '  [' + url.split('/').pop() + ']');
      await new Promise(r => setTimeout(r, Math.min(800 * attempt, 4000)));
    }
  }
}

/*  Lecture de texte brut : sert aux metadonnees XML des depots maven. */
async function getText(url, options) {
  const { res } = await request(url, options);
  const body = await readBody(res, 16 * 1024 * 1024);
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const err = new Error('HTTP ' + res.statusCode);
    err.status = res.statusCode; err.body = body;
    throw err;
  }
  return body;
}

module.exports = { makeToken, cancel, download, getJSON, getText, postJSON, postForm, formBody, request, sha1File, sha256File, UA };