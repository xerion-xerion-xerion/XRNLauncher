/* =============================================================================
   XRNLauncher — logique d'interface (contexte DOM)
   Fonctionne aussi dans un simple navigateur : les fonctions systeme
   sont alors desactivees et un bandeau l'indique.
   ========================================================================== */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand  = (a, b) => a + Math.random() * (b - a);
  const human = v => DESKTOP ? X.env.human(v) : (Math.round((v || 0) / 104857.6) / 10) + ' Mo';
  const X = window.XRN || null;
  const DESKTOP = !!X;
  const ic = (id, s) => `<svg viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use href="#${id}"/></svg>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const STATE = {
    account: null, catalog: null, installed: [], selected: null, saves: [],
    fsPath: null, java: null, token: null, paused: false, lastProgress: null
  };

  /* ================================================================== *
   *  FENETRE MODALE
   * ================================================================== */
   /*  Une fenetre themee plutot que le confirm() du systeme : celui-ci
       bloque l'interface et sort du style de l'application.           */
   const Dialog = {
     _res: null,
     open(opts) {
       return new Promise(resolve => {
         Dialog._res = resolve;
         const wrap = $('#modalWrap');
         const bg = wrap.querySelector('.modal-bg');
         const ico = $('#modalIco');
         ico.className = 'modal-ico' + (opts.kind === 'warn' ? ' warn' : '');
         ico.innerHTML = ic(opts.kind === 'warn' ? 'i-alert' : (opts.icon || 'i-info'), 25);
         $('#modalTitle').textContent = opts.title || '';
         const txt = $('#modalTxt');
         txt.innerHTML = opts.text || '';
         if (opts.html) txt.innerHTML = opts.html;

         const bar = $('#modalBar');
         const note = $('#modalNote');
         bar.hidden = !opts.progress;
         note.hidden = !opts.progress;
         if (opts.progress) { $('#modalBarFill').style.width = '0%'; note.textContent = ''; }

         const ok = $('#modalOk');
         const cancel = $('#modalCancel');
         ok.textContent = opts.ok || 'Confirmer';
         cancel.textContent = opts.cancel || 'Annuler';
         cancel.hidden = !!opts.hideCancel;
         ok.hidden = !!opts.hideOk;
         ok.className = 'btn ' + (opts.danger ? 'danger' : 'primary');

         wrap.hidden = false;
         const onKey = e => { if (e.key === 'Escape' && !opts.hideCancel) Dialog.close(false); };
         document.addEventListener('keydown', onKey);
         Dialog._onKey = onKey;
         bg.onclick = () => { if (!opts.hideCancel) Dialog.close(false); };
         ok.onclick = () => Dialog.close(true);
         cancel.onclick = () => Dialog.close(false);
         setTimeout(() => ok.focus(), 60);
       });
     },
     close(v) {
       const wrap = $('#modalWrap');
       if (wrap) wrap.hidden = true;
       if (Dialog._onKey) { document.removeEventListener('keydown', Dialog._onKey); Dialog._onKey = null; }
       const r = Dialog._res; Dialog._res = null;
       if (r) r(v);
     },
     progress(pct, note) {
       const f = $('#modalBarFill');
       if (f) f.style.width = Math.max(0, Math.min(100, pct)) + '%';
       const n = $('#modalNote');
       if (n && note !== undefined) n.textContent = note;
     },
     stage(txt) {
       const n = $('#modalNote');
       if (n) n.textContent = txt || '';
     },
     confirm(opts) { return Dialog.open(opts); },
     alert(opts) { return Dialog.open(Object.assign({}, opts, { hideCancel: true, ok: opts.ok || 'Fermer' })); }
   };

  /* ================================================================== *
   *  TOASTS
   * ================================================================== */
  const Toast = {
    show(title, msg, kind, ms) {
      const box = $('#toasts');
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || 'info');
      const icons = { info: 'i-info', ok: 'i-check', warn: 'i-alert', err: 'i-alert' };
      el.innerHTML = ic(icons[kind] || 'i-info', 18) + '<div><b></b><span></span></div>';
      el.querySelector('b').textContent = title;
      el.querySelector('span').textContent = msg || '';
      box.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms || 3800);
    }
  };

  /* ================================================================== *
   *  FOND ÉTOILÉ
   * ================================================================== */
  /* Champ d'etoiles leger : fillRect (pas d'arc), 30 fps, halos supprimes */
  (function space() {
    const cv = $('#stars');
    const ctx = cv.getContext('2d', { alpha: true });
    let W = 0, H = 0, stars = [], raf = null, last = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FRAME_MOVE = 1000 / 30;   // souris en mouvement
    const FRAME_IDLE = 700;          // scintillement au repos (~1,4 image/s)
    let lastMove = 0;

    function resize() {
      const dpr = 1;                       // pas de HiDPI : gain de perf net
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp((W * H) / 26000, 28, 70));
      stars = new Array(n);
      for (let i = 0; i < n; i++) {
        stars[i] = {
          x: Math.random() * W, y: Math.random() * H,
          z: 0.35 + Math.random() * 0.65,
          s: (Math.random() < 0.16 ? 2 : 1),
          tw: Math.random() * 6.28, tws: 0.6 + Math.random() * 1.6
        };
      }
      if (reduced) draw(0);
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.tw += 0.014 * s.tws;
        const a = (0.3 + Math.sin(s.tw) * 0.34) * (0.45 + s.z * 0.55);
        const x = s.x + mouse.x * s.z * 16;
        const y = s.y + mouse.y * s.z * 16;
        ctx.fillStyle = s.z > 0.82 ? 'rgba(214,201,255,' + a.toFixed(3) + ')'
          : s.z > 0.5 ? 'rgba(167,139,250,' + a.toFixed(3) + ')'
          : 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.fillRect(x, y, s.s, s.s);
      }
      raf = requestAnimationFrame(draw);
    }

    function loop(t) {
      // si la souris dort, on redessine 20x moins souvent
      const idle = (t - lastMove) > 700;
      const frame = idle ? FRAME_IDLE : FRAME_MOVE;
      if (t - last < frame) { raf = requestAnimationFrame(loop); return; }
      last = t; draw(t);
    }

    addEventListener('resize', resize);
    addEventListener('pointermove', e => {
      mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
      lastMove = performance.now();
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); }
      else { last = 0; raf = requestAnimationFrame(loop); }
    });
    resize();
    // Pause complete pendant le splash (ecran plein opaque) : aucune image dessinee
    const splashEl = document.getElementById('splash');
    if (splashEl) {
      cancelAnimationFrame(raf);
      setTimeout(() => { if (!document.hidden) { last = 0; raf = requestAnimationFrame(loop); } }, 800);
    } else if (!reduced) {
      raf = requestAnimationFrame(loop);
    }
  })();
    /* ================================================================== *
   *  AMBIANCE — nappe sonore douce, entierement generee (aucun fichier)
   * ================================================================== */
  const Ambience = {
    ctx: null, master: null, on: false, timer: null, vol: 0.25,
    boot(vol) {
      if (this.ctx) { this.setVolume(vol); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.vol = vol == null ? 0.25 : vol;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 2.5;
      lp.connect(this.master);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.035;
      const lfoAmp = ctx.createGain(); lfoAmp.gain.value = 300;
      lfo.connect(lfoAmp); lfoAmp.connect(lp.frequency); lfo.start();

      [{ f: 55, g: 0.30, t: 'sine', d: 0 }, { f: 110, g: 0.14, t: 'sine', d: 5 }]
        .forEach(v => {
          const o = ctx.createOscillator();
          o.type = v.t; o.frequency.value = v.f; o.detune.value = v.d;
          const g = ctx.createGain(); g.gain.value = v.g;
          const amp = ctx.createOscillator(); amp.frequency.value = 0.02 + Math.random() * 0.05;
          const ampG = ctx.createGain(); ampG.gain.value = v.g * 0.5;
          amp.connect(ampG); ampG.connect(g.gain); amp.start();
          o.connect(g); g.connect(lp); o.start();
        });

      const len = ctx.sampleRate * 3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3; }
      const noise = ctx.createBufferSource();
      noise.buffer = buf; noise.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.8;
      const ng = ctx.createGain(); ng.gain.value = 0.07;
      const nlfo = ctx.createOscillator(); nlfo.frequency.value = 0.017;
      const nlfoG = ctx.createGain(); nlfoG.gain.value = 210;
      nlfo.connect(nlfoG); nlfoG.connect(bp.frequency); nlfo.start();
      noise.connect(bp); bp.connect(ng); ng.connect(this.master); noise.start();

      this.delay = ctx.createDelay(1.2); this.delay.delayTime.value = 0.42;
      const fb = ctx.createGain(); fb.gain.value = 0.4;
      const dw = ctx.createGain(); dw.gain.value = 0.3;
      this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(dw); dw.connect(this.master);

      this.updateSoundBtn();
    },
    ping() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (!this.on || !this.ctx) return;
        const ctx = this.ctx;
        const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
        const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.25 ? 2 : 1);
        const t0 = ctx.currentTime;
        [1, 2.004].forEach((h, i) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * h;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.05 / (i + 1), t0 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
          o.connect(g); g.connect(this.delay); g.connect(this.master);
          o.start(t0); o.stop(t0 + 3.6);
        });
        this.ping();
      }, 8000 + Math.random() * 12000);
    },
    toggle(force) {
      if (!this.ctx) this.boot();
      if (!this.ctx) { Toast.show('Audio indisponible', 'Ce navigateur ne gère pas Web Audio.', 'warn'); return; }
      const want = force === undefined ? !this.on : force;
      this.on = want;
      if (want && this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(want ? this.vol : 0, t + (want ? 3 : 1));
      if (want) this.ping(); else clearTimeout(this.timer);
      this.updateSoundBtn();
      try { localStorage.setItem('xrn.ambient', want ? '1' : '0'); } catch (e) {}
    },
    setVolume(v) {
      this.vol = v;
      if (this.ctx && this.on) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.linearRampToValueAtTime(v, t + 0.4);
      }
    },
    updateSoundBtn() {
      const b = $('#soundBtn');
      if (!b) return;
      b.classList.toggle('off', !this.on);
      b.innerHTML = ic(this.on ? 'i-volume' : 'i-mute', 17);
      b.setAttribute('data-tip', this.on ? 'Couper la nappe' : 'Activer la nappe');
    }
  };

  const kickAmbience = () => {
    if (!Ambience.ctx) {
      let pref = null;
      try { pref = localStorage.getItem('xrn.ambient'); } catch (e) {}
      if (pref !== '0') Ambience.toggle(true);
    }
    removeEventListener('pointerdown', kickAmbience);
    removeEventListener('keydown', kickAmbience);
  };
  addEventListener('pointerdown', kickAmbience);
  addEventListener('keydown', kickAmbience);

  /* ================================================================== *
   *  TETE DE SKIN — texture Minecraft officielle (hors-ligne apres cache)
   * ================================================================== */
  const SkinHead = {
    cache: new Map(),
    load(url) {
      return new Promise(resolve => {
        if (!url) return resolve(null);
        if (this.cache.has(url)) return resolve(this.cache.get(url));
        const img = new Image();
        img.onload = () => { this.cache.set(url, img); resolve(img); };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    },
    async draw(canvas, url, letter) {
      if (!canvas || typeof canvas.getContext !== 'function') return;
      const px = canvas.width / 8;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, canvas.width, canvas.height);
      const img = await this.load(url);
      if (!img) {
        const grad = g.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#7c3aed'); grad.addColorStop(1, '#c026d3');
        g.fillStyle = grad; g.fillRect(0, 0, canvas.width, canvas.height);
        g.fillStyle = '#fff'; g.font = 'bold ' + (px * 3) + 'px Inter, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText((letter || '?').charAt(0).toUpperCase(), canvas.width / 2, canvas.height / 2 + px * 0.4);
        return;
      }
      g.drawImage(img, 8, 8, 8, 8, 0, 0, 8 * px, 8 * px);
      try { if (img.width >= 64) g.drawImage(img, 40, 8, 8, 8, 0, 0, 8 * px, 8 * px); } catch (e) {}
    }
  };
/* SFX - effet sonore court de demarrage (~1,1 s), genere localement */
  const Sfx = {
    play() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        const ctx = Sfx._ctx || (Sfx._ctx = new AC());
        if (ctx.state === 'suspended') ctx.resume();
        const t0 = ctx.currentTime + 0.02;
        const out = ctx.createGain();
        out.gain.value = 0.34;
        out.connect(ctx.destination);

        [523.25, 659.25, 987.77].forEach((f, i) => {
          const t = t0 + i * 0.11;
          [1, 2.01].forEach((h, k) => {
            const o = ctx.createOscillator();
            o.type = 'sine'; o.frequency.value = f * h;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.22 / (k + 1), t + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
            o.connect(g); g.connect(out);
            o.start(t); o.stop(t + 0.8);
          });
        });

        const len = Math.floor(ctx.sampleRate * 0.55);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
        const n = ctx.createBufferSource(); n.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.Q.value = 1.6;
        bp.frequency.setValueAtTime(320, t0);
        bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.5);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.09, t0);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
        n.connect(bp); bp.connect(ng); ng.connect(out);
        n.start(t0); n.stop(t0 + 0.6);
      } catch (e) { /* audio indisponible */ }
    }
  };
const Splash = {
    shown: true,
    /* Sentence choisie au hasard a chaque lancement */
    lines: [
      { t: "Nous sommes une façon que l'atome a de se connaître.", a: 'Richard Feynman' },
      { t: "Nous sommes un moyen par lequel le cosmos se connaît lui-même.", a: 'Carl Sagan' },
      { t: "L'univers est plus étrange que ce que notre imagination peut concevoir.", a: 'J. B. S. Haldane' },
      { t: "Nous sommes tous dans le caniveau, mais certains d'entre nous regardent les étoiles.", a: 'Oscar Wilde' },
      { t: "Ce n'est pas ce qui t'arrive qui te rend heureux ou malheureux, c'est ton jugement sur les choses.", a: 'Épictète' },
      { t: "Plus haut, plus vite : altius citius.", a: 'Proverbe latin' },
      { t: "Brille comme une étoile filante le temps que tu peux.", a: 'Proverbe japonais' },
      { t: "Nous sommes tous dans la nature ; ce qui est en nous lui vient aussi.", a: 'Sénèque' },
      { t: "Un voyage de mille lie commence par un premier pas.", a: 'Lao Tseu' },
      { t: "L'imagination est le seul instrument de la réalité.", a: 'Paul Valéry' }
    ],
    line: '',
    pick() {
      this.line = this.lines[Math.floor(Math.random() * this.lines.length)];
      return this.line;
    },

    boot() {
      const el = $('#splash');
      if (!el) { this.done(); return; }
      this.pick();
      this.particles();
      setTimeout(() => Sfx.play(), 900);
      $('#spSkip').addEventListener('click', () => this.done());
      addEventListener('keydown', e => { if (e.key === 'Escape') this.done(); }, { once: true });

      const steps = [
        [14, 'Initialisation du moteur…'],
        [34, 'Chargement des sous-systèmes…'],
        [56, 'Vérification de l\'intégrité…'],
        [78, 'Connexion au launcher…'],
        [100, 'Prêt.']
      ];
      let done = false;
      steps.forEach(([p, label]) => setTimeout(() => {
        if (done) return;
        $('#spBar').style.width = p + '%';
        $('#spStatus').textContent = label;
      }, 700 + p * 22));

      // sous-titre mot a mot
      const quote = this.line.t;
      const words = quote.split(' ');
      const sub = $('#spSubtitle');
      let wi = 0;
      const tick = setInterval(() => {
        if (done || !this.shown) return;
        if (wi < words.length) {
          sub.classList.add('on');
          sub.innerHTML = words.slice(0, wi + 1).join(' ') + '<span class="cur"></span>';
          wi++;
        }
      }, 340);

      setTimeout(() => {
        sub.innerHTML = esc(quote) + '<br><span class="sp-author">' + esc(this.line.a) + '</span>';
      }, 700 + words.length * 340 + 200);


      // filet de securite
      setTimeout(() => { if (!done) this.done(); }, 12000);
    },

    particles() {
      const box = $('#spParticles');
      if (!box) return;
      for (let i = 0; i < 46; i++) {
        const p = document.createElement('i');
        p.style.left = rand(0, 100) + 'vw';
        p.style.top = rand(10, 90) + 'vh';
        p.style.setProperty('--dx', rand(-160, 160) + 'px');
        p.style.setProperty('--dy', rand(-260, -40) + 'px');
        p.style.animationDuration = rand(5, 13) + 's';
        p.style.animationDelay = (-rand(0, 10)) + 's';
        const s = rand(1, 2.6);
        p.style.width = s + 'px'; p.style.height = s + 'px';
        box.appendChild(p);
      }
    },

    done() {
      if (!this.shown) return;
      this.shown = false;
      const el = $('#splash');
      if (el) el.classList.add('done');
      setTimeout(() => { if (el) el.remove(); }, 900);
    }
  };

  /* ================================================================== *
   *  NAVIGATION
   * ================================================================== */
  const Nav = {
    items: $$('.nav-item'), views: $$('.view'),
    go(name) {
      const el = document.getElementById('view-' + name);
      if (!el) return;
      this.items.forEach(b => b.classList.toggle('active', b.dataset.view === name));
      this.views.forEach(v => v.classList.toggle('active', v === el));
      $('#content').scrollTop = 0;
      history.replaceState(null, '', '#/' + name);
      this.onEnter(name);
    },
    onEnter(name) {
      if (name === 'versions') Versions.refresh();
      if (name === 'saves') Saves.refresh();
      if (name === 'files') Files.refresh();
      if (name === 'servers') Servers.refresh();
      if (name === 'login') Login.refresh();
      if (name === 'home') Home.refresh();
      if (name === 'mods') Mods.refresh();
    }
  };
  Nav.items.forEach(b => b.addEventListener('click', () => Nav.go(b.dataset.view)));
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); Nav.go(g.dataset.goto); }
  });

  /* ================================================================== *
   *  ACCES API (avec messages lisibles en mode navigateur)
   * ================================================================== */
  async function api(fn, opts) {
    if (!DESKTOP) {
      if (opts && opts.soft) return null;
      Toast.show('Mode aperçu', 'Cette action nécessite l’application Windows (dist\\XRNLauncher\\XRNLauncher.exe).', 'warn', 5200);
      return null;
    }
    try { return await fn(X); }
    catch (e) {
      const msg = (e && (e.body || e.message)) || String(e);
      if (e && e.code === 'nojava') {
        /*  Le message ne se contente plus de constater l'absence de
            Java : il propose de l'installer, sur le meme principe que
            la fenetre qui precede l'installation d'une version.      */
        const besoin = (e.detail && e.detail.need) || 17;
        const issue = await verifierJava(besoin);
        if (issue === 'ok') {
          Toast.show('Java prêt', 'Relance le jeu.', 'ok', 5000);
        } else {
          Toast.show('Java manquant', 'Installez un JDK ' + besoin + '+ ou indiquez le chemin dans Paramètres.', 'err', 8000);
          Settings.openJavaHelp(e.detail);
        }
      } else {
        Toast.show('Erreur', msg.slice(0, 220), 'err', 6500);
      }
      console.error(e);
      return null;
    }
  }

  /* ================================================================== *
   *  COMPTES
   * ================================================================== */
  const Account = {
    apply(acc) {
      STATE.account = acc;
      const holder = $('#accAvatarMini'); // c'est un <span> : on y injecte un canvas
      if (holder && !holder.querySelector('canvas')) holder.innerHTML = '<canvas width="56" height="56"></canvas>';
      SkinHead.draw(holder ? holder.querySelector('canvas') : null, acc ? acc.skinUrl : '', acc ? acc.name : '?');
      $('#accNameMini').textContent = acc ? acc.name : 'Non connecté';
      $('#accSubMini').textContent = acc ? (acc.type === 'offline' ? 'Profil local' : (acc.ownsGame === false ? 'Sans jeu' : 'Microsoft · en ligne')) : 'Cliquer pour se connecter';
      this.renderRail();
      const badge = $('#badgeAccount');
      if (badge) {
        badge.className = 'badge ' + (acc ? 'good' : '');
        badge.innerHTML = ic(acc ? 'i-check' : 'i-user', 13) + (acc ? 'Connecté : ' + esc(acc.name) : 'Aucun compte');
      }
    },
    renderRail() {
      const box = $('#railAccount');
      const acc = STATE.account;
      if (!acc) {
        box.innerHTML = '<p class="empty">Aucun compte connecté.<br><button class="btn sm" style="margin-top:10px" data-goto="login">Se connecter</button></p>';
        return;
      }
      box.innerHTML = `
        <div class="acc-block">
          <div class="acc-frame"><canvas id="railAvatar" width="172" height="172"></canvas></div>
          <div><div class="acc-name">${esc(acc.name)}</div>
          <div class="acc-uuid">${esc(acc.id)}</div></div>
          <span class="acc-type">${ic(acc.type === 'offline' ? 'i-shield' : 'i-check', 12)} ${acc.type === 'offline' ? 'Profil local' : 'Microsoft'}</span>
          <div style="display:flex;gap:8px;width:100%">
            <button class="btn sm" style="flex:1" id="btnRevalidate" title="Renouveler la session et actualiser le skin">Actualiser</button>
            <button class="btn sm" style="flex:1" data-goto="login">Changer</button>
          </div>
          <button class="btn sm danger" style="width:100%" id="btnDisconnect">Se déconnecter</button>
        </div>`;
      SkinHead.draw($('#railAvatar'), acc.skinUrl, acc.name);
      $('#btnDisconnect').addEventListener('click', () => api(x => x.auth.disconnect()).then(() => {
        this.apply(null); Toast.show('Déconnecté', '', 'info', 2000); Login.refresh();
      }));
      $('#btnRevalidate').addEventListener('click', async () => {
        this.pending();
        const a = await api(x => x.auth.revalidate(), { soft: true });
        this.apply(a);
        Toast.show('Session actualisée', a ? a.name : '', 'ok', 2600);
      });
    },

    /* --- etats transitoires de la session ---------------------------- */
    pending() {
      STATE.resuming = true;
      $('#accNameMini').textContent = STATE.account ? STATE.account.name : 'Connexion…';
      $('#accSubMini').textContent = 'Reconnexion en cours…';
    },
    ended(info) {
      STATE.resuming = false;
      if (!info || info.reason === 'none') return;
      const j = info.days ? (' après ' + info.days + ' jours sans utiliser le launcher') : '';
      Toast.show('Connexion à renouveler',
        (info.name ? info.name + ' doit se reconnecter' : 'Session expirée') + j + '.', 'warn', 7000);
    },
    connected(acc) { STATE.resuming = false; this.apply(acc); },
    disconnected() { STATE.resuming = false; this.apply(null); },

    /* --- le menu suit la session, meme apres une reconnexion en fond --- */
    watch() {
      if (!DESKTOP) return;
      X.on('auth:connected', a => this.connected(a));
      X.on('auth:disconnected', () => this.disconnected());
      X.on('auth:resuming', () => this.pending());
      X.on('auth:ended', i => this.ended(i));
    }
  };
  $('#accountChip').addEventListener('click', () => Nav.go('login'));

  /* ================================================================== *
   *  ACCUEIL
   * ================================================================== */
  const Home = {
    async refresh() {
      const inst = await api(x => x.game.installed(), { soft: true }) || [];
      STATE.installed = inst;
      $('#stVersions').textContent = inst.length;
      $('#stVersionsSub').textContent = inst.length ? inst.slice(0, 3).map(v => v.id).join(' · ') : 'installées';

      const saves = await api(x => x.files.saves(), { soft: true }) || [];
      STATE.saves = saves;
      $('#stSaves').textContent = saves.length;
      $('#stSavesSub').textContent = saves.length ? 'dernière : ' + relative(saves[0].lastPlayed) : 'dans le dossier du jeu';

      const disk = await api(x => x.files.disk(), { soft: true });
      if (disk) {
        $('#stSize').textContent = human(disk.total);
        $('#stSizeSub').textContent = disk.free != null ? 'libre : ' + human(disk.free) : 'dossier du jeu';
        $('#diskMini').textContent = human(disk.total);
        renderRailDisk(disk);
      }

      // version par défaut
      if (!STATE.selected) {
        const cfg = await api(x => x.env.config(), { soft: true });
        const pick = (cfg && cfg.lastVersion && inst.find(v => v.id === cfg.lastVersion)) || inst[0];
        if (pick) Version.select(pick.id, true);
        else Version.select(null, true);
      }
      this.renderRecent(saves);
      this.updateInstallBadge();
      this.updateJavaBadge();
    },
    /*  L'etat de Java n'etait jamais rafraichi : le bandeau affichait
        "Java non detecte" meme quand Java etait installe, et le
        mini-compteur du bandeau restait sur "detection…".              */
    async updateJavaBadge() {
      if (!DESKTOP) return;
      const j = await api(x => x.game.javaFor(17), { soft: true });
      const ok = !!(j && j.found);
      const b = $('#badgeJava');
      if (b) {
        b.className = 'badge ' + (ok ? 'good' : 'warn-badge');
        b.innerHTML = ic(ok ? 'i-check' : 'i-alert', 13) +
          (ok ? 'Java ' + (j.version || '').split('.')[0] + ' détecté' : 'Java non détecté');
      }
      const mini = $('#javaMini');
      if (mini) mini.textContent = ok ? (j.version || 'détecté') : 'non détecté';
      const bar = $('#javaBar');
      if (bar) bar.style.width = ok ? '100%' : '0%';
    },
    renderRecent(saves) {
      const box = $('#recentSaves');
      if (!saves.length) { box.innerHTML = '<p class="empty">Aucune sauvegarde. Lancez le jeu ou importez un .zip.</p>'; return; }
      renderSaveGrid(box, saves.slice(0, 3));
    },
    updateInstallBadge() {
      const b = $('#badgeVersion');
      if (!b) return;
      const id = STATE.selected;
      const inst = id && STATE.installed.find(v => v.id === id);
      b.className = 'badge ' + (inst ? 'good' : 'warn-badge');
      b.innerHTML = ic(inst ? 'i-check' : 'i-alert', 13) + (inst ? id + ' installée' : (id ? id + ' à installer' : 'Aucune version installée'));
    }
  };

  function saveCard(s, iconUrl) {
    return `<article class="card">
      <div class="card-art">
        ${iconUrl ? `<img src="${esc(iconUrl)}" alt="" onerror="this.style.display='none'">` : ic('i-save', 44).replace('<svg', '<svg class="big"')}
      </div>
      <div class="card-body">
        <h3 title="${esc(s.name)}">${esc(s.name)}</h3>
        <p>${esc(s.folder)} · ${esc(s.gameType)}${s.hardcore ? ' (hardcore)' : ''}</p>
        <div class="card-meta">
          <span class="card-date">${relative(s.lastPlayed)}</span>
          <span class="card-actions">
            <button class="btn sm primary" data-play-save="${esc(s.folder)}">Jouer</button>
            <button class="btn sm" data-open-save="${esc(s.folder)}">Ouvrir</button>
            <button class="btn sm" data-backup-save="${esc(s.folder)}">.zip</button>
            <button class="btn sm danger" data-del-save="${esc(s.folder)}">${ic('i-trash', 14)}</button>
          </span>
        </div>
      </div>
    </article>`;
  }

  /* vignettes de monde : PNG local du dossier saves/<nom>/icon.png */
  async function withIcons(saves) {
    if (!DESKTOP) return saves.map(s => [s, null]);
    return Promise.all(saves.map(async s => {
      let p = null;
      try { p = await X.files.iconPath(s.folder); } catch (e) {}
      return [s, p ? 'file:///' + String(p).replace(/\\/g, '/').replace(/^\/+/, '/') : null];
    }));
  }

  async function renderSaveGrid(box, saves) {
    const withIco = await withIcons(saves);
    box.innerHTML = withIco.map(([s, u]) => saveCard(s, u)).join('');
    wireSaveCards(box);
  }

  function wireSaveCards(box) {
    $$('[data-play-save]', box).forEach(b => b.addEventListener('click', () => Saves.play(b.dataset.playSave)));
    $$('[data-open-save]', box).forEach(b => b.addEventListener('click', () => Saves.openFolder(b.dataset.openSave)));
    $$('[data-backup-save]', box).forEach(b => b.addEventListener('click', () => {
      Toast.show('Sauvegarde…', 'Compression en cours.', 'info', 2000);
      api(x => x.files.backupSave(b.dataset.backupSave)).then(r => {
        if (r) { Toast.show('Archive créée', r.zip.split(/[\\/]/).pop() + ' (' + human(r.size) + ')', 'ok', 5000); Saves.refresh(); }
      });
    }));
    $$('[data-del-save]', box).forEach(b => b.addEventListener('click', () => {
      if (!confirm('Supprimer définitivement la sauvegarde « ' + b.dataset.delSave + ' » ?')) return;
      api(x => x.files.deleteSave(b.dataset.delSave)).then(r => {
        if (r !== null) { Toast.show('Sauvegarde supprimée', '', 'ok'); Saves.refresh(); Home.refresh(); }
      });
    }));
  }

  /* ================================================================== *
   *  VERSIONS
   * ================================================================== */
  const Version = {
    async loadCatalog(force) {
      if (STATE.catalog && !force) return STATE.catalog;
      const m = await api(x => x.game.manifest(force), { soft: true });
      STATE.catalog = m;
      return m;
    },
    async select(id, silent) {
      STATE.selected = id;
      const inst = STATE.installed.find(v => v.id === id);
      $('#vName').textContent = id || '—';
      $('#vLoader').textContent = inst ? 'installée · ' + human(inst.size) : (id ? 'non installée' : 'aucune');
      $('#btnInstall').disabled = !id || !!inst || !!STATE.token;
      $$('.v-opt').forEach(o => o.classList.toggle('sel', o.dataset.id === id));
      Home.updateInstallBadge();
      if (!silent) this.renderList();
    },
    async renderList() {
      const list = $('#vList');
      const cat = STATE.catalog;
      const inst = STATE.installed;
      const installedHtml = inst.length
        ? inst.map(v => `<button class="v-opt" data-id="${esc(v.id)}"><span><span class="vname">${esc(v.id)}</span><br>
            <span class="vsub">${esc(v.type)} · ${esc(relative(new Date(v.releaseTime).getTime()))}</span></span>
            <span class="tag">installée</span>${ic('i-check', 16).replace('<svg', '<svg class="check"')}</button>`).join('')
        : '';
      const catHtml = cat ? cat.versions
        .filter(v => !inst.find(i => i.id === v.id))
        .slice(0, 40)
        .map(v => `<button class="v-opt" data-id="${esc(v.id)}"><span><span class="vname">${esc(v.id)}</span><br>
            <span class="vsub">${esc(v.type)} · ${esc(relative(new Date(v.releaseTime).getTime()))}</span></span>
            <span class="tag">${v.type === 'release' ? 'release' : 'snapshot'}</span></button>`).join('') : '';
      list.innerHTML = (installedHtml ? `<div style="padding:6px 10px;font-size:9.5px;letter-spacing:.18em;color:var(--dim);text-transform:uppercase">Sur ce PC</div>` + installedHtml : '')
        + (catHtml ? `<div style="padding:10px 10px 6px;font-size:9.5px;letter-spacing:.18em;color:var(--dim);text-transform:uppercase">Catalogue Mojang</div>` + catHtml : '');
      $$('.v-opt', list).forEach(o => o.addEventListener('click', () => {
        this.select(o.dataset.id);
        toggleList(false);
      }));
      $$('.v-opt', list).forEach(o => o.classList.toggle('sel', o.dataset.id === STATE.selected));
    }
  };
  /* Le menu est en position fixe et déplacé dans <body> : il n'est plus
     rogné par le .hero (overflow:hidden) et reste visible au-dessus. */
  function placeList() {
    const list = $('#vList');
    const btn = $('#btnVersion');
    if (!list || !btn || !list.classList.contains('open')) return;
    if (list.parentElement !== document.body) document.body.appendChild(list);
    const r = btn.getBoundingClientRect();
    const w = Math.max(300, Math.min(380, r.width));
    list.style.left = Math.round(Math.min(r.left, innerWidth - w - 14)) + 'px';
    list.style.top = Math.round(r.bottom + 9) + 'px';
    list.style.width = w + 'px';
  }
  function toggleList(force) {
    const list = $('#vList');
    const open = force === undefined ? !list.classList.contains('open') : force;
    if (open && list.parentElement !== document.body) document.body.appendChild(list);
    if (!open && list.parentElement !== document.querySelector('.version-wrap')) {
      const slot = document.querySelector('.version-wrap');
      if (slot) slot.appendChild(list);
    }
    list.classList.toggle('open', open);
    $('#btnVersion').setAttribute('aria-expanded', String(open));
    if (open) placeList();
  }
  addEventListener('resize', placeList);
  addEventListener('scroll', () => { if ($('#vList').classList.contains('open')) toggleList(false); }, true);
  $('#btnVersion').addEventListener('click', () => { Version.loadCatalog(); Version.renderList(); toggleList(); });
  document.addEventListener('click', e => { if (!e.target.closest('.version-wrap') && !e.target.closest('#vList')) toggleList(false); });

  const Versions = {
    async refresh(force) {
      const inst = await api(x => x.game.installed(), { soft: true }) || [];
      STATE.installed = inst;
      const box = $('#installedList');
      box.innerHTML = inst.length ? inst.map(v => `
        <div class="row"><span class="nm">${esc(v.id)} <span style="color:var(--dim)">· ${esc(v.type)} · ${human(v.size)}</span></span>
          <span class="tag inst">installée</span>
          <button class="btn sm" data-sel="${esc(v.id)}">Jouer</button>
          <button class="btn sm danger" data-del="${esc(v.id)}">Supprimer</button></div>`).join('')
        : '<p class="empty">Aucune version installée sur ce PC.</p>';
      $$('[data-sel]', box).forEach(b => b.addEventListener('click', () => { Version.select(b.dataset.sel); Nav.go('home'); }));
      $$('[data-del]', box).forEach(b => b.addEventListener('click', () => removeVersion(b.dataset.del)));

      const catBox = $('#catalogList');
      catBox.innerHTML = '<p class="empty">Chargement du catalogue…</p>';
      const cat = await Version.loadCatalog(force);
      if (!cat) { catBox.innerHTML = '<p class="empty">Catalogue indisponible (connexion Internet requise).</p>'; return; }
      this.renderCatalog();
      await Version.select(STATE.selected, true);
      Version.renderList();
    },
    renderCatalog() {
      const cat = STATE.catalog;
      const q = ($('#versionSearch').value || '').trim().toLowerCase();
      let rows = cat.versions.filter(v => !q || v.id.toLowerCase().includes(q)).slice(0, 150);
      $('#catalogList').innerHTML = rows.map(v => {
        const isInst = STATE.installed.find(i => i.id === v.id);
        return `<div class="row"><span class="nm">${esc(v.id)} <span style="color:var(--dim)">· ${esc(relative(new Date(v.releaseTime).getTime()))}</span></span>
          <span class="tag ${isInst ? 'inst' : ''}">${isInst ? 'installée' : v.type === 'release' ? 'release' : 'snapshot'}</span>
          ${isInst ? `<button class="btn sm" data-sel2="${esc(v.id)}">Jouer</button>`
                   : `<button class="btn sm" data-ins="${esc(v.id)}">Installer</button>`}</div>`;
      }).join('') || '<p class="empty">Aucune version ne correspond.</p>';
      $$('[data-sel2]').forEach(b => b.addEventListener('click', () => { Version.select(b.dataset.sel2); Nav.go('home'); }));
      $$('[data-ins]').forEach(b => b.addEventListener('click', () => startInstall(b.dataset.ins)));
    }
  };
  $('#versionSearch').addEventListener('input', () => Versions.renderCatalog());
  $('#btnRefreshVersions').addEventListener('click', () => { STATE.catalog = null; Versions.refresh(true); });

  async function removeVersion(id) {
    if (!DESKTOP) return api(null);
    const r = await api(x => x.files.remove(x.env.config().gameDir + '\\versions\\' + id));
    if (r !== null) { Toast.show('Version supprimée', id, 'ok'); STATE.installed = STATE.installed.filter(v => v.id !== id); Versions.refresh(); }
  }

  /* ================================================================== *
   *  INSTALLATION
   * ================================================================== */
  /*  Minecraft a besoin de Java pour tourner, meme si le telechargement
      n'en a pas besoin. Si aucun JDK 17 ou 21 n'est present sur la
      machine, on propose de l'installer : Temurin est distribue en
      archive, cela ne demande ni installation systeme ni droit
      administrateur. Le dossier estRanges dans l'espace de
      l'application et le launcher s'en souvient.                        */
   async function verifierJava(besoin) {
    const need = Number(besoin) || 17;
    if (!DESKTOP) return 'ok';
    let info = null;
    try { info = await X.game.javaFor(need); } catch (e) { info = null; }
    if (info && info.found) return 'ok';

    const r = await Dialog.confirm({
      kind: 'warn',
      icon: 'i-alert',
      title: 'Java est requis pour jouer',
      html: 'Pour lancer Minecraft, il faut <b>Java 17</b> (ou Java 21 pour les versions les plus récentes).' +
            '<br><br>Aucun Java n\'a été détecté sur cette machine. Le launcher peut télécharger ' +
            '<b>Temurin</b> (la version libre de Java) directement dans son dossier : ' +
            'aucune installation système, aucun droit administrateur, environ 190 Mo.' +
            '<br><br>Tu peux aussi l\'installer toi-même plus tard, ou l\'ignorer pour l\'instant.',
      ok: 'Installer Java',
      cancel: 'Plus tard'
    });
    if (!r) return 'refuse';   // l'utilisateur prefere continuer sans

    Dialog.open({
      title: 'Installation de Java',
      text: 'Téléchargement de Temurin…',
      progress: true,
      hideCancel: true,
      hideOk: true
    });
    try {
      const res = await X.game.installJava(21);
      Dialog.close(true);
      Toast.show('Java installé', 'Temurin ' + res.version + ' est prêt. Le launcher l\'utilisera automatiquement.', 'ok', 6000);
      await Home.refresh();
      return 'ok';
    } catch (e) {
      Dialog.close(false);
      Dialog.alert({
        kind: 'warn',
        title: 'Installation impossible',
        text: String((e && e.message) || e).slice(0, 220),
        ok: 'Fermer'
      });
      return 'echec';   // on ne bloque pas l'installation de Minecraft
    }
  }

  async function startInstall(id) {
    if (!DESKTOP) return api(null);
    if (STATE.token) { Toast.show('Téléchargement en cours', 'Attendez la fin ou annulez.', 'warn'); return; }
    await verifierJava(17);
    const cat = await Version.loadCatalog();
    const entry = cat && cat.versions.find(v => v.id === id);
    if (!entry) { Toast.show('Version inconnue', id, 'err'); return; }

    STATE.token = X.game.newToken();
    STATE.paused = false;
    $('#dlBadge').hidden = false; $('#dlBadge').textContent = '…';
    $('#dlStrip').hidden = false;
    $('#dlLive').hidden = false;
    Nav.go('downloads');
    Toast.show('Téléchargement', 'Installation de Minecraft ' + id + '…', 'info', 5000);

    const res = await api(x => x.game.install(entry, STATE.token));
    STATE.token = null;
    $('#dlLive').hidden = true;
    /*  La barre de progression sous le bouton JOUER doit disparaitre
        une fois le telechargement termine : elle restait affichee en
        permanence, avec son dernier pourcentage, meme des heures
        apres la fin.                                                    */
    $('#dlStrip').hidden = true;
    if (!res || res.cancelled) { Toast.show('Téléchargement annulé', '', 'warn'); $('#dlBadge').hidden = true; return; }
    STATE.installed = res.installed;
    $('#dlBadge').hidden = true;
    if (res.failed && res.failed.length) {
      Toast.show('Terminé avec erreurs', res.failed.length + ' fichier(s) ont échoué. Réessayez l\'installation.', 'warn', 8000);
    } else {
      Toast.show('Installation terminée', id + ' est prête.', 'ok', 5000);
    }
    Version.select(id, true);
    await Home.refresh();
  }
  $('#btnInstall').addEventListener('click', () => { if (STATE.selected) startInstall(STATE.selected); });
  $('#btnCancelDl').addEventListener('click', () => { if (STATE.token) { X.game.cancelInstall(STATE.token); Toast.show('Annulation…', '', 'warn', 2000); } });
  $('#btnPause').addEventListener('click', () => {
    if (!STATE.token) return;
    STATE.paused = !STATE.paused;
    X.game.pauseInstall(STATE.token, STATE.paused);
    $('#btnPause').innerHTML = ic(STATE.paused ? 'i-play' : 'i-mute', 16) + (STATE.paused ? 'Reprendre' : 'Pause');
  });

  const Downloads = {
    render() {
      const p = STATE.lastProgress;
      const body = $('#dlBody');
      if (!p) { body.innerHTML = '<p class="empty">Aucun téléchargement en cours. Choisissez une version puis « Installer ».</p>'; return; }
      const total = Number(p.total) || 0;
      const done = Number(p.doneBytes) || 0;
      const pct = total ? Math.min(100, Math.round(done * 100 / total)) : 0;
      body.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <svg class="progress-ring" viewBox="0 0 46 46"><circle cx="23" cy="23" r="20" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="4"/>
          <circle cx="23" cy="23" r="20" fill="none" stroke="url(#gRing)" stroke-width="4" stroke-linecap="round"
            stroke-dasharray="125.6" stroke-dashoffset="${(125.6 * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 23 23)"/></svg>
          <div style="flex:1;min-width:200px">
            <div style="display:flex;justify-content:space-between;font-size:13px"><b>${esc(p.version)}</b>
              <span style="font-family:var(--display);color:var(--v2)">${pct} %</span></div>
            <div class="bar" style="height:7px"><i style="width:${pct}%"></i></div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--muted)">
              <span>${human(done)} / ${human(total)}</span>
              <span>${p.filesDone || 0}/${p.files || 0} fichiers · ${human(p.speed)}/s</span></div>
          </div>
        </div>`;
    }
  };

  if (DESKTOP) {
    /*  Le telechargement des ressources produit des milliers
        d'evenements. Reconstruire la zone de progression a chaque
        evenement saturait le rendu : on regroupe les rafraichis. */
    let dlRenderQueued = false;
    function queueDlRender() {
      if (dlRenderQueued) return;
      dlRenderQueued = true;
      const run = function () { dlRenderQueued = false; Downloads.render(); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else setTimeout(run, 60);
    }
    X.on('dl:progress', d => { STATE.lastProgress = d; queueDlRender(); updateStrip(d); });
    X.on('dl:file', d => pushFileRow(d));
    X.on('dl:start', d => { STATE.lastProgress = { version: d.version, total: Number(d.total) || 0, doneBytes: 0, files: d.files || 0, filesDone: 0, speed: 0, current: '' }; $('#dlFiles').innerHTML = ''; const t = $('#dlPanelTitle'); if (t) t.textContent = 'Fichier en cours'; Downloads.render(); });
    X.on('dl:done', d => { const t = $('#dlPanelTitle'); if (t) t.textContent = 'Dernière installation'; Downloads.render(); logGame('ok', 'Installation ' + d.version + ' terminée.'); });
    X.on('dl:error', d => logGame('err', d.name + ' : ' + d.message));
    X.on('dl:stage', d => logGame('', d.text));
    /*  Progression de l'installation de Java, affichee dans la fenetre
        modale qui accompanies le telechargement.                     */
    X.on('java:stage', d => Dialog.stage(d.text));
    X.on('java:progress', d => {
      const pct = d.total ? Math.round(d.done * 100 / d.total) : 0;
      Dialog.progress(pct, pct + ' % · ' + Math.round(d.done / 1048576) + ' / ' + Math.round(d.total / 1048576) + ' Mo');
    });
    X.on('game:spawn', d => logGame('', 'Lancement : ' + d.exe));
    X.on('game:log', d => logGame(d.stream === 'err' ? 'err' : '', d.line));
    X.on('game:exit', d => {
      logGame(d.code === 0 ? 'ok' : 'warn', 'Le jeu s\'est arrêté (code ' + d.code + ').');
      $('#btnPlay').classList.remove('busy', 'ring');
      Toast.show('Jeu arrêté', 'Code de sortie : ' + d.code, 'info', 4000);
    });
  }
  function updateStrip(d) {
    const total = Number(d.total) || 0;
    const done = Number(d.doneBytes) || 0;
    const pct = total ? Math.min(100, done * 100 / total) : 0;
    $('#dlBar').style.width = pct.toFixed(1) + '%';
    $('#dlLabel').textContent = d.current || 'Téléchargement…';
    $('#dlPct').textContent = Math.round(pct) + ' %';
  }
  function pushFileRow(d) {
    const box = $('#dlFiles');
    if (box.querySelector('.empty')) box.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'row';
    el.innerHTML = `<span class="nm">${esc(d.name)}</span><span class="sz">${X ? human(d.size) : ''}</span>`;
    box.insertBefore(el, box.firstChild);
    if (box.children.length > 300) box.removeChild(box.lastChild);
  }
  function logGame(cls, line) {
    const box = $('#gameLog');
    if (box.querySelector('.empty')) box.innerHTML = '';
    const el = document.createElement('div');
    el.className = cls || '';
    el.textContent = line;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 300) box.removeChild(box.firstChild);
  }

  /* ================================================================== *
   *  LANCEMENT
   * ================================================================== */
  async function play(world) {
    if (!DESKTOP) return api(null);
    if (!STATE.account) { Toast.show('Connexion requise', 'Connectez un compte dans l\'onglet Connexion.', 'warn'); return Nav.go('login'); }
    const id = STATE.selected;
    if (!id) { Toast.show('Aucune version', 'Installez d\'abord une version de Minecraft.', 'warn'); return Nav.go('versions'); }
    const cfg = await api(x => x.env.config(), { soft: true });
    if (!STATE.installed.find(v => v.id === id)) {
      Toast.show('Version non installée', id + ' doit être téléchargée avant de jouer.', 'warn');
      return startInstall(id);
    }
    const btn = $('#btnPlay');
    btn.classList.add('busy', 'ring');
    logGame('', '>>> Préparation du lancement (' + id + ')');
    const res = await api(x => x.game.launch({
      version: id, ramGB: cfg.ramGB, world: world || null, extraJavaArgs: cfg.javaArgs
    }));
    if (!res) { btn.classList.remove('busy', 'ring'); return; }
    Toast.show('Minecraft lancé', 'Version ' + id + (world ? ' — monde ' + world : ''), 'ok', 4000);
  }
  $('#btnPlay').addEventListener('click', () => play(null));
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); play(null); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('.title-search input').focus(); }
  });

  /* ================================================================== *
   *  MODS
   * ================================================================== */
  const Mods = {
    async refresh() {
      if (!DESKTOP) {
        const box = $('#loaderBox');
        if (box) box.innerHTML = '<p class="empty">Le gestionnaire de mods est disponible uniquement dans l\'application Windows.</p>';
        const l = $('#modsList');
        if (l) l.innerHTML = '<p class="empty">Le dépôt de mods est disponible uniquement dans l\'application Windows.</p>';
        return;
      }
      const etat = await api(x => x.mods.etat(), { soft: true });
      if (!etat) return;
      const p = $('#modsPath');
      if (p) p.textContent = etat.dossier;
      this.renderList(etat.mods);
      this.renderLoader(etat);
    },

    renderList(mods) {
      const box = $('#modsList');
      if (!box) return;
      if (!mods || !mods.length) { box.innerHTML = '<p class="empty">Aucun mod installé.</p>'; return; }
      box.innerHTML = mods.map(m => `
        <div class="modrow">
          <div class="mod-ico">${ic('i-package', 15)}</div>
          <div class="mod-main">
            <div class="mod-name" title="${esc(m.name)}">${esc(m.name)}</div>
            <div class="mod-sub">${human(m.size)} · ${relative(m.mtime)}</div>
          </div>
          <div class="mod-side">
            <button class="iconbtn danger" data-delmod="${esc(m.name)}" title="Supprimer ce mod">${ic('i-trash', 15)}</button>
          </div>
        </div>`).join('');
      $$('[data-delmod]', box).forEach(b => b.addEventListener('click', async () => {
        const r = await api(x => x.mods.remove(b.dataset.delmod), { soft: true });
        if (r && r.ok) { Toast.show('Mod supprimé', b.dataset.delmod, 'ok', 2400); this.renderList(r.mods); }
      }));
    },

    /*  Un mod n'est pris en compte que si un chargeur est present.
        On affiche donc l'etat du chargeur pour la version choisie et
        on propose l'installation de Fabric ou de NeoForge.            */
    renderLoader(etat) {
      const box = $('#loaderBox');
      if (!box) return;
      const cible = STATE.selected;
      const profils = etat.profils || [];

      let html = '';

      /*  Chargeurs deja installes, tous profils confondus. */
      if (profils.length) {
        for (const pr of profils) {
          html += `<div class="loader-installed">${ic('i-check', 18)}
            <div><b>${esc(pr.loader.nom)}</b> <span>· ${esc(pr.version)}</span>
            <br><span>Sélectionnez ce profil dans l'onglet Versions pour jouer avec vos mods.</span></div></div>`;
        }
      } else {
        html += '<p class="loader-note">Aucun chargeur de mods installé. Minecraft vanilla ignore complètement le dossier <code class="mono">mods</code> : sans chargeur, vos fichiers sont ignorés.</p>';
      }

      if (!cible) {
        html += '<p class="loader-note">Sélectionnez d\'abord une version de Minecraft dans l\'onglet Versions : le chargeur s\'installe sur une version précise.</p>';
      } else {
        html += `<p class="loader-note">Installation sur <b>${esc(cible)}</b> : le profil créé apparaîtra ensuite dans la liste des versions, à côté de la version d'origine.</p>`;
        html += '<div class="loader-row">' +
          '<button class="btn" id="btnFabric">' + ic('i-chip', 16) + 'Installer Fabric</button>' +
          '<button class="btn" id="btnNeoForge">' + ic('i-chip', 16) + 'Installer NeoForge</button>' +
          '</div>';
      }

      box.innerHTML = html;

      const bf = $('#btnFabric');
      if (bf) bf.addEventListener('click', () => this.install('fabric', cible));
      const bn = $('#btnNeoForge');
      if (bn) bn.addEventListener('click', () => this.install('neoforge', cible));
    },

    async install(type, version) {
      if (!version) return;
      const label = type === 'fabric' ? 'Fabric' : 'NeoForge';
      const b = type === 'fabric' ? $('#btnFabric') : $('#btnNeoForge');
      if (b) { b.disabled = true; b.textContent = 'Installation…'; }
      Toast.show(label, 'Préparation de l\'installation sur ' + version + '…', 'info', 4000);
      try {
        const r = type === 'fabric'
          ? await api(x => x.mods.installFabric(version))
          : await api(x => x.mods.installNeoForge(version));
        if (!r) return;
        Toast.show(label + ' installé', 'Profil « ' + r.profil + ' » créé. Sélectionnez-le dans Versions pour jouer avec vos mods.', 'ok', 7000);
        const inst = await api(x => x.game.installed(), { soft: true });
        if (inst) { STATE.installed = inst; }
        await this.refresh();
      } finally {
        if (b) { b.disabled = false; b.textContent = 'Installer ' + label; }
      }
    }
  };

  /* ---- Depot de fichiers ------------------------------------------- */
  function cheminsDesFichiers(list) {
    const out = [];
    for (const f of (list || [])) {
      /*  NW.js ajoute « path » sur l'objet File : c'est le chemin reel
          sur le disque, seul moyen de copier le fichier.            */
      if (f && f.path) out.push(f.path);
    }
    return out;
  }

  async function ajouterMods(list) {
    const chemins = cheminsDesFichiers(list);
    if (!chemins.length) { Toast.show('Dépôt ignoré', 'Aucun fichier .jar exploitable.', 'warn'); return; }
    const r = await api(x => x.mods.add(chemins), { soft: true });
    if (!r) return;
    if (r.ajoutes.length) Toast.show(r.ajoutes.length + ' mod(s) ajouté(s)', r.ajoutes.join(', ').slice(0, 120), 'ok', 5000);
    for (const ref of (r.refuses || [])) Toast.show('Ignoré : ' + ref.name, ref.raison, 'warn', 4200);
    Mods.renderList(r.mods);
  }

  const dropZone = $('#dropMods');
  if (dropZone) {
    const pick = $('#modsPick');
    const choose = $('#btnModsPick');

    dropZone.addEventListener('click', e => {
      if (e.target.closest('#btnModsPick')) return;
      if (pick) pick.click();
    });
    if (choose) choose.addEventListener('click', e => { e.stopPropagation(); if (pick) pick.click(); });
    if (pick) pick.addEventListener('change', e => { ajouterMods(e.target.files); pick.value = ''; });

    ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      dropZone.classList.add('over');
    }));
    ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, e => {
      e.preventDefault(); e.stopPropagation();
      if (ev === 'dragleave' && dropZone.contains(e.relatedTarget)) return;
      dropZone.classList.remove('over');
    }));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      const dt = e.dataTransfer;
      if (!dt) return;
      if (dt.files && dt.files.length) ajouterMods(dt.files);
      else if (dt.items) {
        const fichiers = [];
        for (const it of dt.items) if (it.kind === 'file') { const f = it.getAsFile(); if (f) fichiers.push(f); }
        if (fichiers.length) ajouterMods(fichiers);
      }
    });
  }

  const btnModsFolder = $('#btnModsFolder');
  if (btnModsFolder) btnModsFolder.addEventListener('click', () => api(x => x.mods.openFolder()));
  const btnModsPlay = $('#btnModsPlay');
  if (btnModsPlay) btnModsPlay.addEventListener('click', () => play(null));

  /* ================================================================== *
   *  SAUVEGARDES
   * ================================================================== */
  const Saves = {
    async refresh() {
      const saves = await api(x => x.files.saves(), { soft: true }) || [];
      STATE.saves = saves;
      const box = $('#savesList');
      if (!saves.length) box.innerHTML = '<p class="empty">Aucune sauvegarde dans le dossier du jeu.</p>';
      else await renderSaveGrid(box, saves);

      const bk = $('#backupsList');
      const backups = await api(x => x.files.backups(), { soft: true }) || [];
      bk.innerHTML = backups.length ? backups.map(b => `
        <div class="row"><span class="nm">${esc(b.name)}</span><span class="sz">${human(b.size)} · ${relative(b.mtime)}</span>
        <button class="btn sm" data-openzip="${esc(b.path)}">Dossier</button></div>`).join('') : '<p class="empty">Aucune archive créée.</p>';
      $$('[data-openzip]', bk).forEach(bt => bt.addEventListener('click', () => api(x => x.env.selectInExplorer(bt.dataset.openzip))));

      const gd = await api(x => x.env.config(), { soft: true });
      if (gd) $('#savesPath').textContent = gd.gameDir + '\\saves';
    },
    async play(folder) {
      const cfg = await api(x => x.env.config(), { soft: true });
      if (!cfg) return;
      const id = STATE.selected || (cfg.lastVersion);
      if (!id) { Toast.show('Aucune version', 'Sélectionnez une version installée.', 'warn'); return Nav.go('versions'); }
      if (!STATE.installed.find(v => v.id === id)) { Toast.show('Version non installée', id, 'warn'); return startInstall(id); }
      STATE.selected = id;
      await play(folder);
    },
    openFolder(folder) {
      api(x => x.env.openFolder(x.env.config().gameDir + '\\saves\\' + folder));
    }
  };
  $('#btnOpenSaves').addEventListener('click', () => api(x => x.env.openFolder(x.env.config().gameDir + '\\saves')));
  $('#btnImportSave').addEventListener('click', () => $('#saveFile').click());
  $('#saveFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const p = f.path || (f.webkitRelativePath || '');
    const name = f.name.replace(/\.zip$/i, '');
    const dest = await api(x => x.files.importSave(p, name));
    if (dest) { Toast.show('Sauvegarde importée', name, 'ok'); Saves.refresh(); Home.refresh(); }
    e.target.value = '';
  });

  /* ================================================================== *
   *  EXPLORATEUR DE FICHIERS
   * ================================================================== */
  const Files = {
    async refresh(dir) {
      const data = await api(x => x.files.browse(dir, 0), { soft: true });
      if (!data) { $('#fsBody').innerHTML = '<p class="empty">Explorateur indisponible hors application.</p>'; return; }
      STATE.fsPath = data.path;
      STATE.fsParent = data.parent;
      const crumbs = $('#fsCrumbs');
      const parts = data.path.split(/[\\/]/).filter(Boolean);
      let acc = parts[0] ? parts[0] + (data.path.startsWith('\\\\') ? '\\' : '\\') : '';
      crumbs.innerHTML = parts.map((p, i) => {
        const full = parts.slice(0, i + 1).join('\\');
        return (i ? '<i>\\</i>' : '') + `<button data-crumb="${esc(full)}">${esc(p)}</button>`;
      }).join('');
      $$('[data-crumb]', crumbs).forEach(b => b.addEventListener('click', () => this.refresh(b.dataset.crumb)));

      const body = $('#fsBody');
      body.innerHTML = data.missing ? '<p class="empty">Dossier introuvable : ' + esc(data.path) + '</p>' :
        (data.entries.length ? '<div class="fs-grid">' + data.entries.map(e => {
          const ico = e.dir ? 'i-folder' : e.icon === 'zip' ? 'i-save' : e.icon === 'jar' ? 'i-cube' : e.icon === 'json' ? 'i-list' : e.icon === 'image' ? 'i-palette' : 'i-list';
          return `<div class="fs-item ${e.dir ? 'dir' : ''}">
            <span class="fs-ico">${ic(ico, 17)}</span>
            <span class="fs-info"><span class="fs-name">${esc(e.name)}</span>
              <span class="fs-sub">${e.dir ? 'Dossier' : human(e.size)} · ${relative(e.mtime)}</span></span>
            <span class="fs-act">
              ${e.dir ? `<button class="iconbtn" data-open-dir="${esc(e.path)}">${ic('i-folder', 15)}</button>` : ''}
              <button class="iconbtn" data-show="${esc(e.path)}">${ic('i-external', 15)}</button>
              <button class="iconbtn danger" data-rm="${esc(e.path)}">${ic('i-trash', 15)}</button>
            </span></div>`;
        }).join('') + '</div>' : '<p class="empty">Dossier vide.</p>');

      $$('[data-open-dir]', body).forEach(b => b.addEventListener('click', () => this.refresh(b.dataset.openDir)));
      $$('[data-show]', body).forEach(b => b.addEventListener('click', () => api(x => x.env.selectInExplorer(b.dataset.show))));
      $$('[data-rm]', body).forEach(b => b.addEventListener('click', () => {
        if (!confirm('Supprimer « ' + b.dataset.rm.split(/[\\/]/).pop() + ' » ? Action irréversible.')) return;
        api(x => x.files.remove(b.dataset.rm)).then(r => { if (r !== null) { Toast.show('Supprimé', '', 'ok', 2000); this.refresh(); } });
      }));
    }
  };
  $('#btnFsUp').addEventListener('click', () => { if (STATE.fsParent) Files.refresh(STATE.fsParent); });
  $('#btnFsOpen').addEventListener('click', () => { if (STATE.fsPath) api(x => x.env.openExplorer(STATE.fsPath)); });

  /* ================================================================== *
   *  SERVEURS (ping reel)
   * ================================================================== */
  const Servers = {
    async refresh() {
      const list = await api(x => x.servers.list(), { soft: true }) || [];
      const box = $('#serverList');
      box.innerHTML = list.length ? list.map(s => `
        <div class="srv" data-srv="${esc(s.host)}|${s.port}">
          <span class="srv-ico">${ic('i-globe', 21)}</span>
          <span class="srv-main"><span class="srv-name">${esc(s.name)}</span>
            <span class="srv-mot" data-mot>${esc(s.host)}:${s.port} — test de connexion…</span></span>
          <span class="srv-side"><span class="srv-ping" data-ping>…</span><span class="srv-count" data-count></span></span>
          <button class="btn sm danger" data-del-srv="${esc(s.host)}|${s.port}">Retirer</button>
        </div>`).join('') : '<p class="empty">Aucun serveur enregistré. Ajoutez une adresse ci-dessus.</p>';
      $$('[data-del-srv]', box).forEach(b => b.addEventListener('click', () => {
        const [h, p] = b.dataset.delSrv.split('|');
        api(x => x.servers.remove(h, p)).then(() => this.refresh());
      }));
      list.forEach(s => this.ping(s));
    },
    async ping(s) {
      const row = $(`.srv[data-srv="${CSS.escape(s.host + '|' + s.port)}"]`);
      if (!row) return;
      const st = await api(x => x.servers.status(s.host, s.port), { soft: true });
      const mot = row.querySelector('[data-mot]'), ping = row.querySelector('[data-ping]'), cnt = row.querySelector('[data-count]');
      if (!st) {
        if (mot) mot.textContent = s.host + ':' + s.port + ' — hors ligne';
        if (ping) { ping.textContent = 'OFF'; ping.className = 'srv-ping bad'; }
        return;
      }
      if (mot) mot.textContent = (st.description || 'Sans description') + (st.version ? ' · ' + st.version : '');
      if (ping) { ping.textContent = st.latency + ' ms'; ping.className = 'srv-ping ok'; }
      if (cnt) cnt.textContent = st.players + ' / ' + st.maxPlayers + ' joueurs';
    }
  };
  $('#btnAddSrv').addEventListener('click', () => {
    const host = $('#srvHost').value.trim();
    const port = parseInt($('#srvPort').value, 10) || 25565;
    if (!host) return Toast.show('Adresse manquante', '', 'warn', 2000);
    api(x => x.servers.add(host, port)).then(() => { $('#srvHost').value = ''; Servers.refresh(); });
  });

  /* ================================================================== *
   *  CONNEXION MICROSOFT
   * ================================================================== */
const Login = {
    pollTimer: null,
    reset() {
      const ms = document.getElementById('msCard'); if (ms) ms.hidden = true;
      const so = document.getElementById('soloCard'); if (so) so.hidden = true;
      const cd = document.getElementById('msCode'); if (cd) cd.hidden = true;
    },

    /* --- Microsoft : code d'appareil -------------------------------- */
    async start() {
      document.getElementById('msCard').hidden = false;
      document.getElementById('msCode').hidden = false;
      document.getElementById('msSub').textContent = "Une fen\u00eatre va s'ouvrir dans ton navigateur.";
      const res = await api(x => x.auth.begin());
      if (!res) {
        document.getElementById('msCode').hidden = true;
        return;
      }
      document.getElementById('userCode').textContent = res.userCode;
      this.poll(res);
    },

    /*  Interrogation du serveur Microsoft.
        Deux pieges ecrits ici avant qu'ils ne se reproduisent :

        1) deux boucles ne doivent jamais tourner en meme temps, sinon la
           seconde interroge un device_code deja utilise par la premiere
           et Microsoft repond AADSTS70000 ;
        2) une boucle async peut se recouvrir avec elle-meme si l'appel
           dure plus de 5 s : on serialize avec un verrou.               */
    poll(info) {
      this.stopPolling();

      const bar = document.getElementById('loginBar');
      const start = Date.now();
      this.barTimer = setInterval(() => {
        if (bar) bar.style.width = Math.min(96, 4 + (Date.now() - start) / (info.expiresIn * 10)) + '%';
      }, 500);

      let enCours = false;
      let termine = false;

      this.pollTimer = setInterval(async () => {
        if (enCours || termine) return;      // pas de recouvrement
        enCours = true;
        try {
          const r = await api(x => x.auth.poll());
          if (!r || !r.done) return;
          termine = true;
          this.stopPolling();
          if (bar) bar.style.width = '100%';
          document.getElementById('waitText').textContent = 'R\u00e9cup\u00e9ration de ton profil\u2026';
          const done = await api(x => x.auth.finish(r.tokens));
          if (done) { Account.apply(done.account); Toast.show('Connect\u00e9', done.account.name, 'ok'); this.refresh(); }
        } finally {
          enCours = false;
        }
      }, 5000);
    },

    stopPolling() {
      if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
      if (this.barTimer) { clearInterval(this.barTimer); this.barTimer = null; }
    },

    async refresh() {
      this.reset();
      this.renderCurrent();
      const accounts = await api(x => x.auth.accounts(), { soft: true }) || [];
      const card = document.getElementById('accountsCard');
      card.hidden = !accounts.length;
      const list = document.getElementById('accountsList');
      list.innerHTML = accounts.map(a =>
        '<div class="acc-item">' +
        '<span class="av"><canvas data-acc-id="' + esc(a.id) + '" width="80" height="80"></canvas></span>' +
        '<span class="ai"><span class="an">' + esc(a.name) + '</span><span class="au">' + esc(a.id) + '</span></span>' +
        '<span class="acc-type">' + (a.type === 'offline' ? 'solo' : 'Microsoft') + '</span>' +
        '<button class="btn sm" data-use-acc="' + esc(a.id) + '">Changer</button>' +
        '<button class="btn sm danger" data-rm-acc="' + esc(a.id) + '">Supprimer</button>' +
        '</div>').join('');
      $$('[data-acc-id]', list).forEach(cv => {
        const a = accounts.find(x => x.id === cv.dataset.accId);
        SkinHead.draw(cv, a.skinUrl, a.name);
      });
      $$('[data-use-acc]', list).forEach(b => b.addEventListener('click', () => {
        const a = accounts.find(x => x.id === b.dataset.useAcc);
        api(x => a.type === 'offline' ? x.auth.selectOffline(a.id) : x.auth.selectMicrosoft(a.id)).then(acc => {
          if (acc) { Account.apply(acc); Toast.show('Profil actif', acc.name, 'ok', 2200); }
        });
      }));
      $$('[data-rm-acc]', list).forEach(b => b.addEventListener('click', () => {
        api(x => x.auth.remove(b.dataset.rmAcc)).then(() => {
          if (STATE.account && STATE.account.id === b.dataset.rmAcc) Account.apply(null);
          this.refresh();
        });
      }));
    },

    renderCurrent() {
      const acc = STATE.account;
      const s3 = document.getElementById('loginStep3');
      if (!s3) return;
      if (!acc) { s3.hidden = true; return; }
      s3.hidden = false;
      s3.innerHTML =
        '<div class="connected">' +
        '<div class="big-avatar"><canvas id="bigAvatar" width="220" height="220"></canvas></div>' +
        '<div><div class="cname">' + esc(acc.name) + '</div><div class="cuuid">' + esc(acc.id) + '</div></div>' +
        '<span class="acc-type">' + ic(acc.type === 'offline' ? 'i-shield' : 'i-check', 12) +
        ' ' + (acc.type === 'offline' ? 'Mode solo' : 'Compte Microsoft') + '</span>' +
        '<div class="kvlist">' +
        '<div class="kv"><span>Identifiant</span><b class="mono" style="font-size:11px">' + esc(acc.id) + '</b></div>' +
        '<div class="kv"><span>Session</span><b>' + (acc.type === 'offline' ? 'Hors ligne' : 'En ligne') + '</b></div>' +
        '</div>' +
        '<button class="btn primary" id="btnPlayFromAcc">Jouer maintenant</button>' +
        '</div>';
      SkinHead.draw(document.getElementById('bigAvatar'), acc.skinUrl, acc.name);
      document.getElementById('btnPlayFromAcc').addEventListener('click', () => { Nav.go('home'); play(null); });
    },

  };

  const onClick = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

  onClick('pickMicrosoft', () => {
    Login.stopPolling();
    api(x => x.auth.cancel(), { soft: true });
    Login.reset();
    Login.start();
  });
  onClick('pickSolo', () => { Login.reset(); document.getElementById('soloCard').hidden = false; const s = document.getElementById('soloName'); if (s) s.focus(); });
  onClick('btnCopyCode', () => {
    const c = document.getElementById('userCode').textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(c);
    Toast.show('Code copi\u00e9', c, 'ok', 1800);
  });
  onClick('btnCancelLogin', () => { Login.stopPolling(); api(x => x.auth.cancel(), { soft: true }); Login.reset(); });

  /* ---------- Connexion par token (Authlib-Injector) ---------- */
  const tkVerdict = () => document.getElementById('tkVerdict');
  function tkSay(kind, label, detail) {
    const el = tkVerdict();
    if (!el) return;
    el.hidden = false;
    el.className = 'verdict ' + kind;
    el.innerHTML = '<span class="v-dot"></span><b>' + esc(label) + '</b>'
      + '<span class="v-detail">' + esc(detail) + '</span>';
  }

  $$('[data-tk]').forEach(b => b.addEventListener('click', () => {
    $$('[data-tk]').forEach(x => x.classList.toggle('on', x === b));
    $$('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== b.dataset.tk; });
  }));

  onClick('btnUseToken', async () => {
    const v = (document.getElementById('mcToken').value || '').trim();
    const uuid = (document.getElementById('mcUuid').value || '').trim();
    const nom = (document.getElementById('mcName').value || '').trim();
    if (v.length < 40)
      return tkSay('err', 'Jeton trop court', "Colle le jeton complet : il fait plusieurs centaines de caracteres.");
    if (!uuid)
      return tkSay('err', 'UUID manquant', "Renseigne l'UUID du compte, sinon le skin ne peut pas etre charge.");
    tkSay('wait', 'Lecture du profil…', 'Contact de api.mojang.com.');
    const acc = await api(x => x.auth.addToken(v, uuid, nom), { soft: true });
    if (!acc) { tkSay('err', 'Connexion refusee', "Mojang n'a pas reconnu ce jeton ou cet UUID."); return; }
    document.getElementById('mcToken').value = '';
    Account.apply(acc);
    tkSay('ok', 'Connecte : ' + acc.name, 'Ton skin et ton UUID sont charges. Tu peux lancer le jeu.');
    Toast.show('Connecte', acc.name, 'ok');
    setTimeout(() => Login.refresh(), 900);
  });

  onClick('btnUseCreds', async () => {
    const user = (document.getElementById('tkUser').value || '').trim();
    const pass = document.getElementById('tkPass').value || '';
    const api = (document.getElementById('tkApi').value || '').trim();
    if (!user || !pass) return tkSay('err', 'Identifiants incomplets', 'Renseigne les deux champs.');
    tkSay('wait', 'Connexion…', 'Interrogation du serveur de session.');
    const acc = await api2(() => X.auth.addCredentials(user, pass, api));
    if (!acc) { tkSay('err', 'Connexion refusee', "Le serveur a refuse ces identifiants."); return; }
    document.getElementById('tkPass').value = '';
    Account.apply(acc);
    tkSay('ok', 'Connecte : ' + acc.name, 'Le serveur Refreshera ta session toute seule.');
    Toast.show('Connecte', acc.name, 'ok');
    setTimeout(() => Login.refresh(), 900);
  });

  /* variante de api() qui renvoie une erreur plutot qu'un simple null */
  async function api2(fn) {
    try { return await fn(X); }
    catch (e) {
      const msg = (e && (e.body || e.message)) || String(e);
      Toast.show('Connexion refusee', String(msg).slice(0, 200), 'err', 6000);
      return null;
    }
  }

  onClick('btnSolo', () => {
    const name = document.getElementById('soloName').value.trim();
    if (!name) return Toast.show('Pseudo requis', '', 'warn', 2000);
    api(x => x.auth.addOffline(name)).then(acc => {
      if (acc) {
        Account.apply(acc);
        document.getElementById('soloName').value = '';
        Toast.show('Profil créé', acc.name, 'ok');
        Login.refresh();
      }
    });
  });

  /* ================================================================== *
   *  PARAMETRES
   * ================================================================== */
  const Settings = {
    async refresh() {
      const cfg = await api(x => x.env.config(), { soft: true });
      if (!cfg) return;
      $('#setGameDir').value = cfg.gameDir;
      $('#setUserDir').value = X.env.userDataPath;
      $('#setJava').value = cfg.javaPath || '';
      $('#setJavaArgs').value = cfg.javaArgs || '';
      $('#setGw').value = cfg.gameWidth; $('#setGh').value = cfg.gameHeight;
      $('#setGui').value = String(cfg.guiScale || 3);
      setRange('#setRam', cfg.ramGB, 1, 32);
      setRange('#setVol', Math.round(cfg.ambientVolume * 100), 0, 100);
      $('#dlConc').textContent = cfg.maxDownloads; $('#dlConcVal').textContent = cfg.maxDownloads;
      $$('[data-switch]').forEach(s => {
        const key = s.dataset.switch;
        if (key in cfg) s.classList.toggle('on', !!cfg[key]);
      });
      renderQuickLinks(cfg);
    },
    openJavaHelp(detail) {
      Nav.go('settings');
      const hint = $('#javaHint');
      if (hint && detail) hint.innerHTML = 'Java ' + detail.need + '+ requis. <a href="#" id="dlJavaLink" style="color:var(--v2)">Télécharger Temurin</a>';
      if (hint && detail) $('#dlJavaLink').addEventListener('click', e => { e.preventDefault(); api(x => x.env.openUrl(detail.url)); });
    },
    async save(patch) { await api(x => x.env.saveConfig(patch), { soft: true }); }
  };
  function setRange(sel, val, min, max) {
    const el = $(sel); if (!el) return;
    el.value = val;
    el.style.setProperty('--pct', ((val - min) / (max - min) * 100) + '%');
  }
  function renderQuickLinks(cfg) {
    const box = $('#quickLinks');
    box.innerHTML = '';
    api(x => x.files.quick(), { soft: true }).then(list => {
      if (!list) return;
      (list || []).forEach(q => {
        const b = document.createElement('button');
        b.textContent = q.label + (q.exists ? '' : ' (créé au lancement)');
        b.addEventListener('click', () => { Nav.go('files'); setTimeout(() => Files.refresh(q.path), 60); });
        box.appendChild(b);
      });
    });
  }
  function renderRailDisk(disk) {
    const box = $('#railDisk');
    if (!disk) { box.innerHTML = '<p class="empty">—</p>'; return; }
    const big = disk.entries.filter(e => e.dir).slice(0, 6);
    box.innerHTML = `
      <div class="kv"><span>Total utilisé</span><b>${human(disk.total)}</b></div>
      ${disk.free != null ? `<div class="kv"><span>Espace libre</span><b>${human(disk.free)}</b></div>` : ''}
      <div style="margin-top:10px">${big.map(e => `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:11.5px"><span>${esc(e.name)}</span><span style="color:var(--dim)">${human(e.size)}</span></div>
          <div class="bar"><i style="width:${disk.total ? Math.max(2, e.size / disk.total * 100) : 2}%"></i></div>
        </div>`).join('')}</div>`;
  }

  /* ---------- interactions paramètres ---------- */
  $('#setRam').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    e.target.style.setProperty('--pct', ((v - 1) / 31 * 100) + '%');
    $('#setRamVal').textContent = v.toFixed(1).replace('.0', '') + ' Go';
    $('#stRam').innerHTML = v.toFixed(1) + '<small>Go</small>';
    $$('[data-ram]').forEach(c => c.classList.toggle('on', parseFloat(c.dataset.ram) === v));
    Settings.save({ ramGB: v });
  });
  $$('[data-ram]').forEach(c => c.addEventListener('click', () => {
    const v = parseFloat(c.dataset.ram);
    setRange('#setRam', v, 1, 32);
    $('#setRamVal').textContent = v + ' Go';
    $('#stRam').innerHTML = v + '<small>Go</small>';
    $$('[data-ram]').forEach(x => x.classList.toggle('on', x === c));
    Settings.save({ ramGB: v });
  }));
  $('#setVol').addEventListener('input', e => {
    const v = parseInt(e.target.value, 10);
    e.target.style.setProperty('--pct', v + '%');
    $('#setVolVal').textContent = v + ' %';
    Ambience.setVolume(v / 100);
    Settings.save({ ambientVolume: v / 100 });
  });
  $('#setGw').addEventListener('change', e => Settings.save({ gameWidth: +e.target.value || 1280 }));
  $('#setGh').addEventListener('change', e => Settings.save({ gameHeight: +e.target.value || 720 }));
  $('#setGui').addEventListener('change', e => Settings.save({ guiScale: +e.target.value }));
  $('#setJavaArgs').addEventListener('change', e => Settings.save({ javaArgs: e.target.value }));
  $('#setJava').addEventListener('change', e => Settings.save({ javaPath: e.target.value.trim() }));
  $$('[data-switch]').forEach(s => s.addEventListener('click', () => {
    s.classList.toggle('on');
    const patch = {}; patch[s.dataset.switch] = s.classList.contains('on');
    if (s.dataset.switch === 'ambientSound') Ambience.toggle(patch.ambientSound);
    Settings.save(patch);
  }));
  $$('[data-step]').forEach(b => b.addEventListener('click', () => {
    const el = $('#dlConcVal');
    let v = clamp(parseInt(el.textContent, 10) + (+b.dataset.step), 1, 12);
    el.textContent = v; $('#dlConc').textContent = v;
    Settings.save({ maxDownloads: v });
  }));
  $('#btnTestJava').addEventListener('click', async () => {
    const p = $('#setJava').value.trim();
    const hint = $('#javaHint');
    hint.textContent = 'Recherche en cours…';
    const res = await api(x => x.game.javaFor(0));
    if (!res) { hint.textContent = 'Vérification impossible hors application.'; return; }
    const forced = p ? res.tested.find(t => t.path === p) : null;
    hint.innerHTML = res.found
      ? `<span style="color:#8df0cb">Java ${res.version} détecté</span> — ${esc(res.path)}`
      : `<span style="color:#ffb0bd">Aucun Java 8+ détecté</span> (${res.tested.length} candidat(s) testés). Installez Temurin ${res.need}.`;
  });
  $('#btnDownloadJava').addEventListener('click', () => api(x => x.env.openUrl(x.game.adoptiumUrl(17))));
  $('#btnOpenUserDir').addEventListener('click', () => api(x => x.env.openFolder(X.env.userDataPath)));
  $('#btnPickGameDir').addEventListener('click', async () => {
    Toast.show('Dossier du jeu', 'Modifiez le chemin dans config.json puis relancez l\'application.', 'info', 5000);
    const hint = $('#gameDirHint');
    if (hint) hint.textContent = 'Chemin défini dans config.json (clé gameDir).';
  });
  $('#btnReload').addEventListener('click', () => { Home.refresh(); Toast.show('Actualisé', '', 'ok', 1500); });

  /* ================================================================== *
   *  VIDEOS — deux dernieres publications de la chaine Xerion
   * ================================================================== */
  const VIDEOS = {
    channel: 'UC3E0PoYxTmceOBYNavTqDSg',
    handle: 'https://www.youtube.com/@xerionmc',
    list: [
      { id: 'bTpKi0bU710', title: 'Je suis PARTI à la RECHERCHE de ce JOUEUR sur ce SMP HARDCORE', date: '31 août 2026', views: '1 494 vues', likes: '75' },
      { id: 'sZ2FohWa_3w', title: "J'ai BÂTI la CIVILISATION la plus PUISSANTE sur ce SMP HARDCORE", date: '8 juillet 2026', views: '18 590 vues', likes: '520' }
    ],
    more: [
      { id: '4NVmIKo1tLk', title: "J'ai INFILTRÉ et TRAHI la Meilleure Team de ce SMP", date: '30 juin 2026', views: '3 335 vues' },
      { id: 'Zynbsy_Qqek', title: 'Récupérer TOUTES les Elytras de ce SMP', date: '1 oct. 2025', views: '1 346 vues' }
    ],
    render() {
      const grid = $('#vidGrid');
      if (!grid) return;
      grid.innerHTML = this.list.map(v => `
        <article class="vid-card" data-vid="${v.id}">
          <div class="vid-thumb">
            <img class="vid-poster" loading="lazy" alt="" src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" />
            <div class="vid-play"><span>${ic('i-play', 22)}</span></div>
          </div>
          <div class="vid-body">
            <h4>${esc(v.title)}</h4>
            <div class="vid-meta"><span>${ic('i-clock2', 12)} ${esc(v.date)}</span>
              <span>${esc(v.views)}</span><span>♥ ${esc(v.likes || '')}</span></div>
          </div>
        </article>`).join('');
      $$('.vid-card', grid).forEach(card => {
        const play = () => {
          const box = card.querySelector('.vid-thumb');
          box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + card.dataset.vid +
            '?autoplay=1&rel=0" title="YouTube" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
        };
        card.querySelector('.vid-poster').addEventListener('click', play);
        card.querySelector('.vid-play').addEventListener('click', play);
      });

      const more = $('#vidMore');
      more.innerHTML = this.more.map(v => `
        <div class="vid-row">
          <img loading="lazy" alt="" src="https://i.ytimg.com/vi/${v.id}/default.jpg" />
          <span class="vr-info"><span class="vr-t">${esc(v.title)}</span><span class="vr-m">${esc(v.date)} · ${esc(v.views)}</span></span>
          <button class="btn sm" data-open-vid="${v.id}">Regarder</button>
        </div>`).join('');
      $$('[data-open-vid]', more).forEach(b => b.addEventListener('click', () => window.open('https://www.youtube.com/watch?v=' + b.dataset.openVid, '_blank')));
    }
  };
  $('#btnChannel').addEventListener('click', () => {
    if (DESKTOP) X.env.openUrl(VIDEOS.handle); else window.open(VIDEOS.handle, '_blank');
  });

  /* ---------- fenetre (via window.nw, contexte DOM) ---------- */
  function nwWin() { try { return (window.nw && window.nw.Window) ? window.nw.Window.get() : null; } catch (e) { return null; } }
  $('#winMin').addEventListener('click', () => {
    const w = nwWin();
    if (w) w.minimize(); else Toast.show('Reduire', 'Disponible uniquement dans l application.', 'info', 2000);
  });
  $('#winMax').addEventListener('click', () => {
    const w = nwWin();
    if (!w) return Toast.show('Agrandir', 'Disponible uniquement dans l application.', 'info', 2000);
    if (w.windowState === 'maximized') w.unmaximize(); else w.maximize();
  });
  $('#winClose').addEventListener('click', () => { const w = nwWin(); if (w) w.close(); else window.close(); });

  /* Toute erreur de l interface atterrit dans les journaux -------------- */
  addEventListener('error', e => {
    if (DESKTOP) X.report('UI-ERREUR', e.message + ' @ ' + String(e.filename || '').split(/[\\/]/).pop() + ':' + e.lineno);
  });
  addEventListener('unhandledrejection', e => { if (DESKTOP) X.report('UI-REJET', e.reason); });
  addEventListener('beforeunload', () => { if (DESKTOP) X.report('FENETRE', 'document unload'); });
  addEventListener('visibilitychange', () => { if (DESKTOP) X.report('FENETRE', 'visibilite=' + document.visibilityState); });
  if (DESKTOP) { X.report('UI', 'interface chargee'); setInterval(() => X.report('PING', 'actif'), 15000); }
  $('#soundBtn').addEventListener('click', () => Ambience.toggle());

  /* ================================================================== *
   *  HORLOGE + HELPERS
   * ================================================================== */
  (function clock() {
    const el = $('#clock');
    const t = () => { const d = new Date(); el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    t(); setInterval(t, 10000);
  })();

  function relative(ts) {
    if (!ts) return 'jamais';
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return 'il y a ' + m + ' min';
    const h = Math.floor(m / 60);
    if (h < 24) return 'il y a ' + h + ' h';
    const d = Math.floor(h / 24);
    if (d < 30) return 'il y a ' + d + ' j';
    return new Date(ts).toLocaleDateString('fr-FR');
  }

  /* ================================================================== *
   *  DÉMARRAGE
   * ================================================================== */
  setTimeout(function () {
    if (!window.XRN) document.title = 'XRN-DIAG main=' + (window.__XRN_START || 'ABSENT') + ' require=' + (typeof require) + ' nw=' + (typeof window.nw);
  }, 2500);

  (async function boot() {
    Splash.boot();
    if (DESKTOP) {
      $('#brandTag').textContent = 'v' + X.version;
      Account.watch();
      // on laisse le launcher s'afficher tout de suite, puis on reconnecte
      Account.apply(null);
      Settings.refresh();
      const acc = await X.auth.resume();
      Account.apply(acc);
      await Home.refresh();
      if (!acc) { Nav.go('login'); Toast.show('Bienvenue', 'Connectez votre compte Microsoft pour commencer.', 'info', 5200); }
      else Nav.go((location.hash || '#/home').replace('#/', ''));
      Home.refresh();
    } else {
      $('#brandTag').textContent = 'aperçu navigateur';
      const view = $('#view-home');
      view.insertAdjacentHTML('afterbegin',
        `<div class="banner">${ic('i-alert', 18)}<div><b>Mode aperçu.</b> Les fonctions système (téléchargement, fichiers, Java) ne sont actives que dans l'application Windows.</div></div>`);
      Account.apply(null);
      const inst = [{ id: '1.21.1', type: 'release', size: 0, releaseTime: Date.now() }, { id: '1.20.1', type: 'release', size: 0, releaseTime: 0 }];
      STATE.installed = inst;
      Version.select('1.21.1', true);
      STATE.catalog = { latest: { release: '1.21.1' }, versions: [{ id: '1.21.1', type: 'release', releaseTime: Date.now() }, { id: '1.20.1', type: 'release', releaseTime: 0 }] };
      Version.renderList();
    }
    VIDEOS.render();
    Ambience.updateSoundBtn();
  })();
})();