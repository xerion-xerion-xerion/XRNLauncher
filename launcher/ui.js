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
     _prompt: false,
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
         txt.textContent = opts.text || '';
         if (opts.html) txt.innerHTML = opts.html;

         const bar = $('#modalBar');
         const note = $('#modalNote');
         bar.hidden = !opts.progress;
         note.hidden = !opts.progress;
         if (opts.progress) { $('#modalBarFill').style.width = '0%'; note.textContent = ''; }

         /*  Champ de saisie, pour les cas ou il faut vraiment demander
             une valeur (pseudo, nom de monde...) et pas seulement un
             oui ou non.                                                 */
         const field = $('#modalField');
         const input = $('#modalInput');
         const err = $('#modalErr');
         Dialog._prompt = !!opts.input;
         field.hidden = !opts.input;
         err.hidden = true;
         if (opts.input) {
           input.value = opts.input.value || '';
           input.placeholder = opts.input.placeholder || '';
           input.maxLength = opts.input.maxlength || 64;
         }

         /*  Valide la saisie ; un message d'erreur reste affiche tant que
             la valeur n'est pas acceptable, la fenetre ne se ferme pas. */
         const valider = () => {
           if (!Dialog._prompt) return true;
           const msg = opts.validate ? opts.validate(input.value.trim()) : null;
           if (msg) { err.textContent = msg; err.hidden = false; input.focus(); return false; }
           return true;
         };

         const ok = $('#modalOk');
         const cancel = $('#modalCancel');
         ok.textContent = opts.ok || 'Confirmer';
         cancel.textContent = opts.cancel || 'Annuler';
         cancel.hidden = !!opts.hideCancel;
         ok.hidden = !!opts.hideOk;
         ok.className = 'btn ' + (opts.danger ? 'danger' : 'primary');

         wrap.hidden = false;
         const onKey = e => {
           if (e.key === 'Escape' && !opts.hideCancel) { Dialog.close(false); return; }
           if (e.key === 'Enter' && Dialog._prompt) { e.preventDefault(); if (valider()) Dialog.close(true); }
         };
         document.addEventListener('keydown', onKey);
         Dialog._onKey = onKey;
         bg.onclick = () => { if (!opts.hideCancel) Dialog.close(false); };
         ok.onclick = () => { if (valider()) Dialog.close(true); };
         cancel.onclick = () => Dialog.close(false);
         setTimeout(() => (Dialog._prompt ? input : ok).focus(), 60);
       });
     },
     close(v) {
       const wrap = $('#modalWrap');
       if (wrap) wrap.hidden = true;
       if (Dialog._onKey) { document.removeEventListener('keydown', Dialog._onKey); Dialog._onKey = null; }
       /*  En mode saisie, la promesse resout la chaine saisiee, ou null
           si l'utilisateur a annule ou laisse le champ vide.          */
       const input = $('#modalInput');
       const prompt = Dialog._prompt;
       const valeur = (prompt && input) ? input.value.trim() : '';
       Dialog._prompt = false;
       const r = Dialog._res; Dialog._res = null;
       if (r) r(prompt ? (v ? valeur : null) : v);
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
     prompt(opts) { return Dialog.open(Object.assign({}, opts, { input: opts.input || true })); },
     alert(opts) { return Dialog.open(Object.assign({}, opts, { hideCancel: true, ok: opts.ok || 'Fermer' })); }
   };

  window.XrnDialogs={confirm:opts=>Dialog.confirm(opts),prompt:opts=>Dialog.prompt(opts)};

  /* ================================================================== *
   *  TOASTS
   * ================================================================== */
  const Toast = {
    show(title, msg, kind, ms, action) {
      const box = $('#toasts');
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || 'info');
      const icons = { info: 'i-info', ok: 'i-check', warn: 'i-alert', err: 'i-alert' };
      el.innerHTML = ic(icons[kind] || 'i-info', 18) + '<div><b></b><span></span></div>';
      el.querySelector('b').textContent = title;
      el.querySelector('span').textContent = msg || '';
      /*  Bouton d action facultatif : c est lui qui permet de
          telecharger depuis la notification.                        */
      if (action && action.label) {
        const b = document.createElement('button');
        b.className = 'toast-act';
        b.textContent = action.label;
        b.addEventListener('click', () => { try { action.run(); } catch (e) {} el.remove(); });
        el.querySelector('div').appendChild(b);
      }
      while(box.children.length>=3)box.firstElementChild.remove();box.appendChild(el);
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms || 3800);
    }
  };

  /*  Message de l auteur : il peut envoyer n importe quoi, pas
      seulement une mise a jour. Le message porte un identifiant : on
      ne le montre qu une fois, et seulement s il change.            */
  let notificationVue = false;

  /*  Cherche une version plus recente du launcher, une seule fois par
      session. Le resultat est partage entre la notification et la barre
      de mise a jour : une seule requete a GitHub, et les deux
      affichages racontent la meme histoire.                           */
  let miseAJourInfo = null, miseAJourPromise = null;
  async function infoMiseAJour() {
    if(miseAJourInfo)return miseAJourInfo;
    if(!miseAJourPromise)miseAJourPromise=Promise.resolve().then(()=>X.env.chercherMiseAJour()).then(r=>miseAJourInfo=r).catch(()=>miseAJourInfo={ok:false});
    return miseAJourPromise;
  }

  /*  Un poids lisible : 81 Ko, 1,4 Mo. */
  function poids(octets) {
    const n = Number(octets) || 0;
    if (!n) return 'quelques kilo-octets';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
    return (n / 1048576).toFixed(1).replace('.', ',') + ' Mo';
  }

  /*  Applique la mise a jour sur place : le launcher se telecharge,
      se remplace, et se relance. Le joueur n a rien a decompresser et
      rien a installer. C est ce qu on attend d un vrai launcher.    */
  async function demarrerMiseAJour(r) {
    const cible = (r && r.mode === 'patch') ? r.patch
                : (r && r.mode === 'noyau') ? r.noyau
                : (r && r.telecharger);
    if (!cible) {
      maj.fermer();
      Toast.show('Mise a jour', 'Le fichier de mise a jour est introuvable sur le serveur.', 'err', 8000);
      return false;
    }
    maj.ouvrir(r.version);
    const r2 = await api(x => x.env.appliquerMiseAJour(cible, r.taille, r.mode));
    if (r2 && r2.ok) {
      const t = $('#majTexte');
      if (t) t.textContent = 'Installation... le launcher va se relancer.';
      Toast.show('Mise a jour', 'Le launcher se relance tout seul.', 'ok', 6000);
      return true;
    }
    maj.fermer();
    const detail = (r2 && r2.detail) ? ' : ' + r2.detail : '';
    Toast.show('Mise a jour impossible', 'Le telechargement a echoue' + detail, 'err', 9000);
    return false;
  }

  async function verifierNotification() {
    if (notificationVue) return;
    notificationVue = true;
    let r = null;
    try { r = await X.env.notification(); } catch (e) { return; }
    if (!r || !r.id || /^(capes|boutique|cosmetiques?)-/i.test(r.id)) return;

    /*  Un message qui porte une version annonce une mise a jour du
        launcher. Dans ce cas, on n ouvre surtout pas le navigateur : le
        joueur a deja le launcher installe, il veut qu il se mette a jour
        tout seul. Le bouton applique donc la mise a jour sur place.  */
    const annonceVersion = !!(r.version || (r.lien && /\.zip(\?|$)/i.test(r.lien)));
    if (annonceVersion) {
      const info=await infoMiseAJour();
      if(info?.ok){await verifierMiseAJour();try{X.env.marquerNotificationVue(r.id);}catch{}}
      // An already installed release is acknowledged without another update notice.
      else if(info?.version&&info?.courant){try{X.env.marquerNotificationVue(r.id);}catch{}}
      return;
    }
    try{X.env.marquerNotificationVue(r.id);}catch{}

    Toast.show(r.titre || 'XRNLauncher', r.texte || '', r.niveau || 'info', 24000,
      r.lien ? { label: r.bouton || 'Ouvrir', run: () => { X.env.openUrl(r.lien); } } : null);
  }

  /*  Cherche une version plus recente du launcher et previent, une
      seule fois par session. Sans reseau ou en cas d erreur, on ne
      dit rien : une notification inutile serait pire que pas de
      notification du tout.                                          */
  let miseAJourVue = false;
  async function verifierMiseAJour() {
    if (miseAJourVue) return;
    miseAJourVue = true;
    const r = await infoMiseAJour();
    if (!r || !r.ok) return;
    /*  Sans fichier a telecharger, on ne propose rien : on ne
        telechargera pas une page web en la prenant pour une archive. */
    if (!r.patch && !r.noyau && !r.telecharger) return;
    /*  La notification devient une BARRE, visible en permanence sur
        l accueil : on ne peut pas la manquer comme un message qui
        disparait.                                                       */
    const barre = $('#barreMaj');
    if (barre) {
      const titre = $('#barreMajTitre');
      const texte = $('#barreMajTexte');
      const bouton = $('#barreMajBtn');
      if (titre) titre.textContent = 'XRNLauncher v' + r.version + ' est disponible';
      if (texte) {
        const quoi = r.mode === 'patch'
          ? poids(r.taille) + ' a telecharger, et rien d autre.'
          : r.mode === 'noyau'
          ? 'l application seule, ' + poids(r.taille) + ', sans le runtime.'
          : 'mise a jour complete, ' + poids(r.taille) + ' (le runtime change).';
        texte.textContent = 'Vous utilisez la v' + r.courant + ' - ' + quoi;
      }
      if (bouton) {
        bouton.textContent = 'Mettre a jour';
        bouton.onclick = async () => {
          bouton.disabled = true;
          bouton.textContent = 'Telechargement...';
          const ok = await demarrerMiseAJour(r);
          if (!ok) {
            bouton.disabled = false;
            bouton.textContent = 'Mettre a jour';
          }
        };
      }
      barre.hidden = false;
      const fermer = $('#barreMajFermer');
      if (fermer) fermer.onclick = () => { barre.hidden = true; };
    }
    /*  Le message reste, pour ceux qui ferment la barre. Le bouton
        applique la mise a jour sur place, comme la barre : envoyer vers
        un navigateur pour retelecharger 188 Mo n a jamais ete utile. */
    Toast.show('Nouvelle mise a jour',
      'XRNLauncher v' + r.version + ' est en ligne. Vous avez la v' + r.courant + '.',
      'info', 24000,
      { label: 'Mettre a jour',
        run: () => demarrerMiseAJour(r) });
  }

  /* ================================================================== *
   *  FOND ÉTOILÉ
   * ================================================================== */
  /* Champ d'etoiles : legere, et surtout ARRETEE quand elle ne
     fait rien.

     Le fond etait anime en permanence : meme a 1,4 image par seconde au
     repos, la boucle redemandait une image a 60 Hz. Or demander une
     image suffit a woke le compositeur, qui recomposait toute la fenetre
     a chaque fois : le processus GPU tournait en continu pour rien.

     On ne redemande donc une image que lorsqu'il y en a besoin :
       - 30 images/s tant que la souris bouge ;
       - une image toutes les 700 ms pour le scintillement, en pause ;
       - rien du tout quand l'onglet est masque.                      */
  (function space() {
    const cv = $('#stars');
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d', { alpha: true });
    let W = 0, H = 0, stars = [];
    let raf = null;         // image en cours (reste null au repos)
    let repos = null;       // minuterie du scintillement au repos
    let veille = null;      // minuterie de bascule vers le repos
    let last = 0;           // horodatage du dernier dessin
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FRAME_MOVE = 1000 / 30;
    const FRAME_IDLE = 700;
    const ARRET = 700;      // sans mouvement depuis, on passe en repos

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
      last = t;
    }

    /*  Mouvement : une image toutes les FRAME_MOVE, sans arret.        */
    function anime(t) {
      raf = requestAnimationFrame(anime);
      if (t - last < FRAME_MOVE) return;
      draw(t);
    }

    /*  Repos : plus aucun rAF. Une seule image, puis on dort.         */
    function auRepos() {
      raf = null;
      const t = performance.now();
      const restant = FRAME_IDLE - (t - last);
      if (restant > 0) { repos = setTimeout(auRepos, restant); return; }
      draw(t);
      repos = setTimeout(auRepos, FRAME_IDLE);
    }

    function dormir() {
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      if (repos !== null) { clearTimeout(repos); repos = null; }
      if (veille !== null) { clearTimeout(veille); veille = null; }
    }

    function reveiller() {
      if (document.hidden) return;
      if (repos !== null) { clearTimeout(repos); repos = null; }
      if (raf === null) { last = 0; raf = requestAnimationFrame(anime); }
      if (veille !== null) { clearTimeout(veille); veille = null; }
      veille = setTimeout(() => {
        veille = null;
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
        auRepos();
      }, ARRET);
    }

    addEventListener('resize', () => { resize(); if (!reduced) reveiller(); });
    addEventListener('pointermove', e => {
      mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
      if (!reduced) reveiller();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) dormir();
      else if (!reduced) reveiller();
    });

    resize();
    /*  Pendant le splash l'ecran est opaque : aucune image n'est
        dessinee, et surtout aucune boucle ne tourne.                  */
    if (reduced) draw(0);
    else if (!document.getElementById('splash')) auRepos();
  })();
    /* ================================================================== *
   *  AMBIANCE — nappe sonore douce, entierement generee (aucun fichier)
   * ================================================================== */
  const SkinHead = {
    cache: new Map(), pending:new Map(),jobs:new WeakMap(),
    load(value) {
      if(!value)return Promise.resolve(null);
      const url=String(value).replace(/^http:\/\/textures\.minecraft\.net\//,'https://textures.minecraft.net/');
      if(!/^https:\/\//i.test(url)&&!/^lib\/assets\/head-(alex|steve)\.png$/.test(url))return Promise.resolve(null);
      if(this.cache.has(url))return Promise.resolve(this.cache.get(url));
      if(this.pending.has(url))return this.pending.get(url);
      const task=new Promise(resolve=>{
        const img=new Image();let finished=false;
        const finish=value=>{if(finished)return;finished=true;clearTimeout(timer);if(value){this.cache.set(url,value);if(this.cache.size>48)this.cache.delete(this.cache.keys().next().value);}resolve(value);};
        const timer=setTimeout(()=>{finish(null);img.src='';},5000);
        img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=url;
      }).finally(()=>this.pending.delete(url));this.pending.set(url,task);return task;
    },
    async draw(canvas, url, letter, avatarUrl) {
      if (!canvas || typeof canvas.getContext !== 'function') return;
      const ticket=Symbol();this.jobs.set(canvas,ticket);
      const px = canvas.width / 8;
      const g = canvas.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, canvas.width, canvas.height);
      const fallback=await this.load(this.textureTete(letter||'?'));
      if(this.jobs.get(canvas)!==ticket)return;
      if(fallback)this.face3d(g,fallback,canvas.width,canvas.height);

      /*  Un compte Xbox n'a pas d'image Minecraft, mais bien une image de
          profil : on l'affiche en carre, en entier.                    */
      if (!url && avatarUrl) {
        const av = await this.load(avatarUrl);
        if(this.jobs.get(canvas)!==ticket)return;
        if (av) {
          g.imageSmoothingEnabled = true;
          const c = Math.min(canvas.width, canvas.height);
          const r = Math.max(av.width, av.height);
          g.drawImage(av, (av.width - r) / 2, (av.height - r) / 2, r, r, (canvas.width - c) / 2, (canvas.height - c) / 2, c, c);
          return;
        }
      }

      /*  Ordre de preference pour la skin :
            1. celle connue du profil (connexion Minecraft reussie) ;
            2. celle que le joueur porte reellement, cherchee par son
               pseudo chez Mojang — c'est ce qui rend l'avatar juste
               pour un profil solo ou Xbox, qui n'a pas de skin ;
            3. Steve ou Alex, en dernier recours.                       */
      const nom = String(letter || '');
      let img = await this.load(url);
      if (!img && /^[A-Za-z0-9_]{3,16}$/.test(nom) && DESKTOP && X && X.skin) {
        try {
          const trouve = await X.skin.parNom(nom);
          if (trouve) img = await this.load(trouve);
        } catch (e) { /* pas de reseau : on continue */ }
      }
      if(this.jobs.get(canvas)!==ticket)return;
      if (img) {
        g.clearRect(0,0,canvas.width,canvas.height);
        /*  La region de la tete est identique dans une skin 64x64 et
            dans une 64x32 : le rendu 3D marche dans les deux cas.    */
        if (img.width >= 64 && img.height >= 32) { this.face3d(g, img, canvas.width, canvas.height); return; }
        g.drawImage(img, 8, 8, 8, 8, 0, 0, 8 * px, 8 * px);
        return;
      }

      /*  Aucune skin connue : on rend la tete Steve ou Alex, toujours
          presente dans le launcher, choisie comme le fait le jeu.       */
      if (nom) {
        const tete = await this.load(this.textureTete(nom));
        if(this.jobs.get(canvas)!==ticket)return;
        if (tete) { this.face3d(g, tete, canvas.width, canvas.height); return; }
      }

      if(fallback)return;
      const grad = g.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, '#2a2145'); grad.addColorStop(1, '#1b1630');
      g.fillStyle = grad; g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#cfc4f5'; g.font = 'bold ' + (px * 3) + 'px Inter, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText((letter || '?').charAt(0).toUpperCase(), canvas.width / 2, canvas.height / 2 + px * 0.4);
    },

    /*  Steve ou Alex ? Le jeu tranche sur un bit du pseudo, d'ou la
        meme regle ici : le meme nom donne toujours la meme tete.      */
    textureTete(nom) {
      let h = 0;
      const s = String(nom);
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return 'lib/assets/head-' + ((h & 1) === 0 ? 'steve' : 'alex') + '.png';
    },

    /*  Ancien rendu 3D remplacé par une face 2D. Chaque face est
        un carre 8x8 de la texture, pose par une matrice qui le deforme
        en parallélogramme.

        Deux pieges corriges ici, tous deux invisibles a l'ecran :
        - g.setTransform REMPLACE la matrice : il annulerait le translate
          precedent et la tete partirait dans un coin. C'est g.transform
          qui compose avec la matrice courante ;
        - la hauteur utile du cube vaut 2*h + d. Il faut donc remonter le
          centre de d/2, sinon la tete deborde par le bas.            */
    face3d(g, img, largeur, hauteur) {
      const unit=img.width/64;
      const size=Math.floor(Math.min(largeur,hauteur)/8)*8;
      const x=Math.floor((largeur-size)/2),y=Math.floor((hauteur-size)/2);
      g.imageSmoothingEnabled=false;
      g.drawImage(img,8*unit,8*unit,8*unit,8*unit,x,y,size,size);
      g.drawImage(img,40*unit,8*unit,8*unit,8*unit,x,y,size,size);
    }

  };
/* SFX - effet sonore court de demarrage (~1,1 s), genere localement */
const Splash = {
    shown: true, t0: 0, minuterie: null, tape: null,
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

    boot() { this.t0 = Date.now(); this.done(); },

    /*  Appele quand l'interface est prete. Le splash disparait alors,
        sans attendre le filet de securite de 12 secondes : on laisse
        juste le temps de voir le X et l'etoile se dessiner.          */
    ready() {
      const minimum = 0;
      const restant = Math.max(0, minimum - (Date.now() - this.t0));
      clearTimeout(this.minuterie);
      this.minuterie = setTimeout(() => this.done(), restant);
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
      clearInterval(this.tape);
      clearTimeout(this.minuterie);
      /*  Si l'utilisateur coupe l'animation avant la fin (clic sur le
          X ou Echap), on termine proprement : sans cela la barre peut
          rester bloquee a mi-parcours pendant la fonte.                 */
      const bar = $('#spBar'), st = $('#spStatus');
      if (bar) bar.style.width = '100%';
      if (st) st.textContent = 'Prêt.';
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
      if (name === 'videos') name = 'home';
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
      if (name === 'shots') window.XrnGallery?.refresh();
      if (name === 'files') { $('#fsBody').innerHTML = '<p class="empty">Lecture du dossier…</p>'; setTimeout(() => Files.refresh(), 0); }
      if (name === 'servers') Servers.refresh();
      if (name === 'downloads') refreshDownloadedVersions();
      if (name === 'login') Login.refresh();
      if (name === 'home') Home.refresh();
      if (name === 'mods') setTimeout(() => Mods.refresh(), 0);
      if (name === 'discover') setTimeout(() => Catalog.refresh(), 0);
      if (name === 'boutique') window.XrnShop?.refresh();
      if (name === 'prime') window.XrnPrime?.refresh();

    }
  };
  Nav.items.forEach(b => b.addEventListener('click', () => Nav.go(b.dataset.view)));
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); Nav.go(g.dataset.goto); }
  });

  /*  « Acces rapides » de l'accueil : ces boutons ouvraient un dossier
      du jeu via data-open. Aucun gestionnaire n'ecoutait cet
      attribut — les quatre boutons Saves / Mods / Captures / Logs
      ne faisaient donc rien du tout. La delegation manquante est ici.  */
  /*  « Acces rapides » de l'accueil : ces boutons visaient un dossier du
      jeu via data-open. Aucun gestionnaire n'ecoutait cet attribut,
      les quatre boutons Saves / Mods / Captures / Logs ne faisaient donc
      rien du tout.

      Ils ouvraient surtout un explorateur Windows derriere la fenetre du
      launcher, qui fait 1440x860 : le dossier s'ouvrait, mais on ne le
      voyait pas. On navigue donc dans l'onglet Fichiers du launcher,
      ce qui est plus simple et surtout visible.                      */
  const ACCES_RAPIDES = {
    saves: 'Sauvegardes', mods: 'Mods', screenshots: 'Captures',
    logs: 'Journaux', config: 'Configuration', resourcepacks: 'Packs de ressources'
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    e.preventDefault();

    const cle = String(b.dataset.open || '').toLowerCase();
    if (!ACCES_RAPIDES[cle]) return;
    if(cle==='screenshots'){Nav.go('shots');return;}
    if (DESKTOP) X.report('UI', 'acces rapide : ' + cle);

    /*  Le dossier peut ne pas encore exister : on le cree d'abord,
        sinon la navigation afficherait une page vide.                 */
    api(x => x.env.dossierJeu(cle)).then(chemin => {
      Nav.go('files');
      setTimeout(() => Files.refresh(chemin), 80);
      Toast.show(ACCES_RAPIDES[cle], 'Dossier ouvert dans Fichiers', 'ok', 2200);
    });
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
      if(e?.cancelled||e?.code==='launch_cancelled')return {cancelled:true};
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
      /*  Les erreurs ne doivent pas disparaitre dans la console : c'est
          le seul moyen de savoir ce qui a echoue sur la machine de
          l'utilisateur, qui n'a pas de console a ouvrir.              */
      if (DESKTOP) X.report('UI-ERREUR', (e && e.message ? e.message : String(e)) + ' | ' + msg.slice(0, 160));
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
      SkinHead.draw(holder ? holder.querySelector('canvas') : null, acc ? acc.skinUrl : '', acc ? acc.name : '?', acc ? acc.avatarUrl : '');
      $('#accNameMini').textContent = acc ? acc.name : 'Non connecté';
      $('#accSubMini').textContent = acc
        ? (acc.type === 'offline' ? 'Profil local'
          : 'Compte Microsoft' + (acc.gamertag ? ' · ' + acc.gamertag : ''))
        : 'Cliquer pour se connecter';
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
      SkinHead.draw($('#railAvatar'), acc.skinUrl, acc.name, acc.avatarUrl);
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
      const j = await api(x => x.game.javaFor(0), { soft: true });
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
      $('#vLoader').textContent = inst
        ? (inst.loader ? inst.loader.nom + ' · ' : '') + 'installée · ' + human(inst.size)
        : (id ? 'non installée' : 'aucune');
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
      /*  Un scroll fermait la liste, meme celui de la liste elle-meme :
        or c'est justement en faisant defiler qu'on parcourt les
        versions. On ne ferme donc que si le scroll vient d'ailleurs. */
    addEventListener('scroll', e => {
      if (!$('#vList').classList.contains('open')) return;
      const t = e.target;
      if (t && t.closest && t.closest('#vList')) return;
      toggleList(false);
    }, true);
  $('#btnVersion').addEventListener('click', () => { Version.loadCatalog(); Version.renderList(); toggleList(); });
  document.addEventListener('click', e => { if (!e.target.closest('.version-wrap') && !e.target.closest('#vList')) toggleList(false); });

  const Versions = {
    async refresh(force) {
      const inst = await api(x => x.game.installed(), { soft: true }) || [];
      STATE.installed = inst;
      const box = $('#installedList');
      box.innerHTML = inst.length ? inst.map(v => `
        <div class="row"><span class="nm">${esc(v.id)} <span style="color:var(--dim)">· ${esc(v.type)} · ${human(v.size)}</span>${v.loader ? ` <span class="tag mod">${esc(v.loader.nom)}</span>` : ''}</span>
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
      if (!cat) return;
      let rows = cat.versions.filter(v => q ? v.id.toLowerCase().includes(q) : v.type === 'release').slice(0, 150);
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
  $$('[data-version-preset]').forEach(b=>b.onclick=()=>{$('#versionSearch').value=b.dataset.versionPreset;Versions.renderCatalog();});
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
   /*  Microsoft ne distribue plus le pseudo aux applications tierces :
       profile.xboxlive.com repond 404 et SISU refuse le jeton. Le jeu se
       lancera donc en mode hors-ligne sous le nom choisi ici. L'identite
       Xbox, elle, a bien ete verifiee par XSTS.                     */
   async function demanderPseudo(xuid) {
     const precedent = STATE.account && STATE.account.type === 'xbox' && STATE.account.xuid === xuid
       ? STATE.account.name : '';
     return Dialog.prompt({
      title: 'Choisis ton pseudo',
      html: 'Ton compte Xbox est reconnu' +
            (xuid ? ' (identifiant <b>' + esc(xuid) + '</b>)' : '') +
            ', mais Microsoft ne communique plus ton pseudo aux applications tierces.' +
            '<br><br>Choisis le nom sous lequel tu joueras. Le jeu fonctionnera en mode' +
            ' hors-ligne : solo, mods et serveurs hors-ligne. Les serveurs en ligne et Realms' +
            ' resteront inaccessibles tant que l\'application n\'est pas enregistree aupres de Mojang.',
      input: { value: precedent, placeholder: 'Ton pseudo', maxlength: 16 },
      validate: (v) => {
        if (!v) return 'Le pseudo ne peut pas être vide.';
        if (v.length > 16) return '16 caractères maximum.';
        if (!/^[A-Za-z0-9_]+$/.test(v)) return 'Lettres, chiffres et tiret bas uniquement.';
        return null;
      },
      ok: 'Jouer sous ce nom',
      cancel: 'Annuler'
    });
   }

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
      html: 'Cette installation de Minecraft nécessite <b>Java ' + need + '</b>.' +
            '<br><br>Aucun Java compatible n\'a été trouvé pour cette version. Le launcher peut télécharger ' +
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
      const res = await X.game.installJava(need);
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
    const cat = await Version.loadCatalog();
    const entry = cat && cat.versions.find(v => v.id === id);
    if (!entry) { Toast.show('Version inconnue', id, 'err'); return; }

    STATE.token = X.game.newToken();
    STATE.paused = false;
    $('#dlBadge').hidden = false; $('#dlBadge').textContent = '…';
    $('#dlStrip').hidden = false;
    $('#dlLive').hidden = false;
    $('#btnPause').disabled=false;$('#btnCancelDl').disabled=false;
    $('#btnPause').innerHTML=ic('i-mute',16)+'Pause';
    Nav.go('downloads');
    Toast.show('Téléchargement', 'Installation de Minecraft ' + id + '…', 'info', 5000);

    const res = await api(x => x.game.install(entry, STATE.token));
    STATE.token = null;
    $('#dlLive').hidden = true;
    $('#btnPause').disabled=true;$('#btnCancelDl').disabled=true;
    refreshDownloadedVersions();
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
    X.on('mods:notice',d=>logGame('',d.text));
    X.on('mods:stage',d=>{logGame('',d.text);if(STATE.launching)$('#launchStatus').textContent=d.text;});
    X.on('dl:start', d => { STATE.lastProgress = { version: d.version, total: Number(d.total) || 0, doneBytes: 0, files: d.files || 0, filesDone: 0, speed: 0, current: '' }; $('#dlFiles').innerHTML = ''; const t = $('#dlPanelTitle'); if (t) t.textContent = 'Installation en cours'; Downloads.render(); });
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
    X.on('game:ready',d=>{STATE.launching=false;$('#btnPlay').classList.remove('busy','ring');$('#launchStatus').textContent='Minecraft prêt · écran du jeu chargé.';});
    X.on('game:spawn', d => logGame('', 'Lancement : ' + d.exe));
    X.on('game:log', d => logGame(d.stream === 'err' ? 'err' : '', d.line));
    X.on('game:exit', d => {
      logGame(d.code === 0 ? 'ok' : 'warn', 'Le jeu s\'est arrêté (code ' + d.code + ').');
      $('#btnPlay').classList.remove('busy', 'ring');
      STATE.launching=false;$('#launchProgress').hidden=false;$('#launchStatus').textContent=d.cancelled?'Lancement annulé.':d.code===0?'Jeu fermé.':'Le jeu s’est arrêté · diagnostic dans le journal.';$('#btnCancelLaunch').hidden=false;$('#btnCancelLaunch').disabled=false;$('#btnCancelLaunch').textContent='Ouvrir le journal';
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
    if(STATE.launching){window.XrnDiagnostics?.open();return;}
    if(X.game.running()?.running){window.XrnDiagnostics?.open();return;}
    if (!STATE.account) { Toast.show('Connexion requise', 'Connectez un compte dans l\'onglet Connexion.', 'warn'); return Nav.go('login'); }
    const id = STATE.selected;
    if (!id) { Toast.show('Aucune version', 'Installez d\'abord une version de Minecraft.', 'warn'); return Nav.go('versions'); }
    const cfg = await api(x => x.env.config(), { soft: true });
    if (!STATE.installed.find(v => v.id === id)) {
      Toast.show('Version non installée', id + ' doit être téléchargée avant de jouer.', 'warn');
      return startInstall(id);
    }

    /*  Des mods sont deposes dans le dossier, mais la version choisie
        n'est pas un profil de chargeur : le jeu demarrerait, mais les
        mods seraient purement et simplement ignores. C'est le piege le
        plus courant, on propose donc de le corriger sur-le-champ.   */
    const clientBuilds = await api(x => x.game.clientBuilds(), {soft:true}) || [];
    const preparesClient = cfg && cfg.clientEnabled !== false && clientBuilds.some(b=>b.minecraft===id);
    const modState = await api(x => x.mods.etat(), { soft: true });
    if (!preparesClient && modState && (modState.mods || []).some(m => !m.disabled)) {
      const estChargeur = (modState.profils || []).some(p => p.version === id);
      if (!estChargeur) {
        const r = await Dialog.confirm({
          kind: 'warn',
          icon: 'i-alert',
          title: 'Tes mods ne seront pas chargés',
          html: 'Tu as <b>' + modState.mods.length + ' mod(s)</b> dans le dossier mods, mais <b>' + esc(id) + '</b> est une version vanilla.' +
                '<br><br>Minecraft ignore complètement le dossier mods sans un chargeur : le jeu se lancera, mais sans tes mods.' +
                '<br><br>Installer <b>Fabric</b> sur cette version et lancer le profil qui va avec ?',
          ok: 'Installer Fabric',
          cancel: 'Jouer quand même'
        });
        if (r) {
          await Mods.install('fabric', id);
          const etat2 = await api(x => x.mods.etat(), { soft: true });
          const cree = ((etat2 && etat2.profils) || []).find(p => p.base === id);
          if (cree) {
            const liste = await api(x => x.game.installed(), { soft: true });
            if (liste) STATE.installed = liste;
            await Version.select(cree.version, true);
            Toast.show('Profil créé', cree.version + ' est sélectionné. Relance le jeu.', 'ok', 6000);
            return play(world);
          }
          return;
        }
      }
    }
    if(STATE.launching)return;STATE.launching=true;const btn = $('#btnPlay');
    btn.classList.add('busy', 'ring');$('#launchProgress').hidden=false;$('#launchStatus').textContent='Préparation du lancement…';$('#btnCancelLaunch').hidden=false;$('#btnCancelLaunch').disabled=false;$('#btnCancelLaunch').textContent='Ouvrir le journal';
    logGame('', '>>> Préparation du lancement (' + id + ')');
    const res = await api(x => x.game.launch({
      version: id, ramGB: cfg.ramGB, world: world || null, extraJavaArgs: cfg.javaArgs
    }));
    if(!res||res.cancelled){STATE.launching=false;btn.classList.remove('busy','ring');}$('#btnCancelLaunch').hidden=false;$('#btnCancelLaunch').disabled=false;$('#btnCancelLaunch').textContent='Ouvrir le journal';$('#launchStatus').textContent=res?.cancelled?'Lancement annulé.':res?'Minecraft démarre · suivez le journal.':'Lancement interrompu · ouvrir le journal.';
  }
  $('#btnCancelLaunch').onclick=()=>window.XrnDiagnostics?.open();
  $('#btnPlay').addEventListener('click', () => play(null));
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); play(null); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('.title-search input').focus(); }
  });

  /* ================================================================== *
   *  BOUTIQUE
   * ================================================================== */
  /*  Le catalogue vient du serveur, les droits aussi. Le client ne
      decide rien : il montre ce que le serveur a accorde, et il
      demande un code quand le joueur en a un.                         */
  function majEtatBoost(cfg) {
    const actif = !!(cfg && cfg.boostFps);
    const badge = $('#boostBadge');
    if (badge) badge.hidden = !actif;
    const btn = $('#boostBtn');
    if (btn) {
      btn.textContent = actif ? 'Desactiver le mode Profil FPS Plus' : 'Activer le mode Profil FPS Plus';
      btn.classList.toggle('danger', actif);
    }
  }
  $('#boostBtn').addEventListener('click', async () => {
    const cfg = await api(x => x.env.config(), { soft: true });
    const actif = !!(cfg && cfg.boostFps);
    const r = await api(x => x.env.saveConfig({ boostFps: !actif }));
    majEtatBoost(r);
    Toast.show('Profil FPS Plus', !actif
      ? 'Le profil de performance sera applique au prochain lancement.'
      : 'Le jeu retrouvera tes reglages au prochain lancement.', 'ok', 5000);
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
      this.renderIntegre(etat.integres || []);
      this.renderList(etat.mods);
      this.renderLoader(etat);

    },

    /*  Le mod embarque : la version vient du nom du jar integre et la
        liste des modules decrit ce qui existe dans le jeu aujourd'hui.
        Rien a telecharger, rien a installer : c est dans le launcher.  */
    renderIntegre(integres) {
      const box = $('#integreModules');
      const ver = $('#integreVersion');
      const jar = (integres || []).find(n => /^xrn-hud-/i.test(n));
      const v = jar ? (jar.match(/xrn-hud-([0-9]\.[0-9]+\.[0-9]+)/i) || [])[1] : '';
      if (ver) ver.textContent = v ? 'v' + v : '';
      if (!box) return;
      const modules = [
        {nom:'Balises',txt:'Points nommés par monde, serveur et dimension, avec distance en jeu.'},
        {nom:'Inventaire et totems',txt:'Grille des 27 cases, places libres et compteur de totems.'},
        {nom:'Informations de jeu',txt:'FPS, coordonnées, ping, jour, mémoire, vitesse et session.'},
        {nom:'Motion Blur',txt:'Flou de mouvement GPU, intensité réglable de 0 à 100 %, HUD net.'},
        {nom:'Free Look',txt:'Maintenir V pour déplacer la caméra sans tourner le personnage. Touche configurable.'},
        {nom:'Touches et CPS',txt:'Clavier, souris et clics sur une seconde glissante.'},
        {nom:'Armure et effets',txt:'Équipement, durabilité, potions et durées.'},
        {nom:'Contours et hitboxes',txt:'Couleurs et épaisseur de l’affichage personnalisables.'},
        {nom:'Auto Text et Auto Connect',txt:'Texte après élimination ou mort et serveur au démarrage, désactivés par défaut.'},
        {nom:'Musique et Shader Monitor',txt:'Lecture Windows et état des shaders Iris si installé.'},
        {nom:'Éditeur HUD',txt:'Déplacer, redimensionner par les bords et masquer au survol.'}
      ];
      box.innerHTML = modules.map(m =>
        '<div class="integre-module">' +
          '<div><b>' + esc(m.nom) + (m.nov ? ' <i class="integre-nov">nouveau</i>' : '') + '</b>' +
          '<span>' + esc(m.txt) + '</span></div>' +
        '</div>').join('');
    },

    renderList(mods) {
      if (mods) this.items = mods;
      const items = this.items || [];
      const query = ($('#modFilter').value || '').trim().toLocaleLowerCase();
      const filtered = items.filter(m => m.name.toLocaleLowerCase().includes(query));
      $('#modCount').textContent = items.filter(m => !m.disabled).length + ' actifs / ' + items.length;
      const box = $('#modsList');
      if (!filtered.length) { box.innerHTML = '<p class="empty">' + (query ? 'Aucun mod ne correspond à ce nom.' : 'Aucun fichier importé. Ajoutez vos mods au format .jar.') + '</p>'; return; }
      box.innerHTML = filtered.map(m => `
        <div class="modrow ${m.disabled ? 'mod-disabled' : ''}">
          <div class="mod-ico">${ic('i-package', 15)}</div>
          <div class="mod-main"><div class="mod-name" title="${esc(m.name)}">${esc(m.name.replace(/\.disabled$/i, ''))}</div>
          <div class="mod-sub">${human(m.size)} · ${m.disabled ? 'Désactivé' : 'Actif'} · ${relative(m.mtime)}</div></div>
          <div class="mod-side"><button class="mod-toggle" role="switch" aria-checked="${!m.disabled}" aria-label="Activer ${esc(m.name)}" data-togglemod="${esc(m.name)}"><span aria-hidden="true"></span></button>
          <button class="iconbtn danger" data-delmod="${esc(m.name)}" title="Supprimer ce mod" aria-label="Supprimer ${esc(m.name)}">${ic('i-trash', 15)}</button></div>
        </div>`).join('');
      $$('[data-togglemod]', box).forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        const r = await api(x => x.mods.setEnabled(b.dataset.togglemod, /\.disabled$/i.test(b.dataset.togglemod)), { soft: true });
        if (r && r.ok) { this.renderList(r.mods); Toast.show('Mod mis à jour', 'Le changement prendra effet au prochain lancement du jeu.', 'ok', 4000); }
        else { b.disabled = false; Toast.show('Modification impossible', r && r.message || 'Le fichier est indisponible.', 'warn', 5000); }
      }));
      $$('[data-delmod]', box).forEach(b => b.addEventListener('click', async () => {
        const ok = await Dialog.open({title: 'Supprimer ce mod ?', text: b.dataset.delmod, ok: 'Supprimer', cancel: 'Annuler', kind: 'warn'});
        if (!ok) return;
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

      /*  Le cas le plus frequent : des mods sont deposes mais aucun
          chargeur n'est installe. Sans chargeur, Minecraft ignore
          completement le dossier mods : mieux vaut le dire.         */
      const modsPresents = (etat.mods || []).filter(m => !m.disabled).length;
      const baseCible = cible;
      const aUnChargeur = profils.some(p => p.base === baseCible || p.version === baseCible);
      if (modsPresents && baseCible && !aUnChargeur) {
        html += '<div class="mod-warn">' + ic('i-alert', 18) +
          '<div><b>Tes ' + modsPresents + ' mods ne seront pas chargés.</b>' +
          '<p>Minecraft sans chargeur ignore complètement le dossier <code class="mono">mods</code>. ' +
          'Il te faut un profil de chargeur pour ' + esc(baseCible) + '.</p>' +
          '<button class="btn" id="btnWarnFabric">' + ic('i-chip', 16) + 'Installer Fabric pour ' + esc(baseCible) + '</button>' +
          '</div></div>';
      }

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
      const bw = $('#btnWarnFabric');
      if (bw) bw.addEventListener('click', () => this.install('fabric', baseCible));
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

  $('#modFilter').addEventListener('input', () => Mods.renderList());
  const Catalog = {
    generation:0,offset:0,lastKey:'',
    async refresh(){
      const profiles=await api(x=>x.modCatalog.contexts(),{soft:true})||[];
      const select=$('#catalogInstallation'),previous=select.value||STATE.selected;
      select.innerHTML=profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.version)} · ${esc(p.loader)}</option>`).join('')||'<option value="">Catalogue général — aucune installation</option>';
      select.disabled=!profiles.length;
      if(profiles.some(p=>p.id===previous))select.value=previous;
      this.profiles=profiles;$('#catalogSearch').disabled=false;this.describe();
      const key=this.key();if(key!==this.lastKey)await this.search(0);
    },
    key(){return [$('#catalogInstallation').value,$('#catalogQuery').value.trim(),$('#catalogSort').value].join('|');},
    describe(){
      const p=(this.profiles||[]).find(p=>p.id===$('#catalogInstallation').value);
      document.querySelector('.catalog-panel .tag').textContent=p?'Version et chargeur vérifiés':'Parcourir sans installer';$('#catalogContext').textContent=p?`Pour Minecraft ${p.version} · ${p.loader}. Les dépendances requises sont proposées avant le téléchargement.`:'Explorez les mods sans installation. Ajoutez une version avec un chargeur dans Installations pour pouvoir télécharger.';
    },
    async search(offset=0){
      const installation=$('#catalogInstallation').value;
      const generation=++this.generation,key=this.key();this.offset=offset;$('#catalogSearch').disabled=true;
      const box=$('#catalogResults');box.textContent='Recherche des mods compatibles…';$('#catalogPagination').hidden=true;
      try{
        const result=await X.modCatalog.search('modrinth',$('#catalogQuery').value,installation,{sort:$('#catalogSort').value,offset});
        if(generation!==this.generation)return;this.lastKey=key;this.result=result;
        const locale=window.XrnLanguage?.get()==='en'?'en-GB':'fr-FR';const compact=n=>Number(n||0).toLocaleString(locale,{notation:'compact',maximumFractionDigits:1});
        const category=n=>({'library':'Bibliothèque','optimization':'Optimisation','utility':'Utilitaire','decoration':'Décoration','worldgen':'Monde','adventure':'Aventure','technology':'Technique'}[n]||n.replace(/-/g,' '));
        const canInstall=!!installation&&!!result.context&&!result.browseOnly;$('#catalogCount').textContent=Number(result.total||0).toLocaleString(locale)+' mods · '+(canInstall?result.context.version+' / '+result.context.loader:'Catalogue général');$('#catalogInstallHint').hidden=canInstall;
        box.innerHTML=result.items.length?result.items.map((p,i)=>`<article class="catalog-row" role="listitem">
          <span class="catalog-mod-icon" aria-hidden="true"><span>${esc(p.title.slice(0,1))}</span>${p.icon?`<img alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(p.icon)}">`:''}</span>
          <div class="catalog-mod-main"><h5>${esc(p.title)}</h5><p>${esc(p.description)}</p><div class="catalog-mod-meta"><span class="catalog-author"><i aria-hidden="true">${esc(p.author.slice(0,1).toUpperCase())}</i>${esc(p.author)}</span><span class="catalog-loader">${esc(result.context?.loader||(p.loaders||[]).join(' / ')||'Minecraft')}</span>${(p.categories||[]).filter(v=>!['fabric','forge','quilt','neoforge','minecraft','liteloader','rift','babric'].includes(v)).slice(0,2).map(v=>`<span class="catalog-category">${esc(category(v))}</span>`).join('')}</div></div>
          <div class="catalog-mod-side"><div class="catalog-mod-stats"><span title="Téléchargements">${ic('i-download',12)} ${compact(p.downloads)}</span>${p.updated?`<span title="Dernière mise à jour">${esc(relative(Date.parse(p.updated)))}</span>`:''}</div><div class="catalog-row-actions"><button class="btn sm catalog-view" data-catalog-view="${i}">Voir ↗</button><button class="btn sm catalog-install" data-catalog="${i}" ${canInstall?'':'disabled title="Installez une version pour télécharger"'}>Installer</button></div></div>
        </article>`).join(''):'<p class="empty">Aucun mod pour cette recherche et cette installation.</p>';
        $$('img',box).forEach(img=>img.addEventListener('error',()=>{img.hidden=true;},{once:true}));
        if(canInstall)$$('[data-catalog]',box).forEach(b=>b.onclick=()=>this.install('modrinth',result.items[Number(b.dataset.catalog)],installation,b));
        $$('[data-catalog-view]',box).forEach(b=>b.onclick=()=>api(x=>x.env.openUrl(result.items[Number(b.dataset.catalogView)].url)));
        const end=offset+result.items.length;$('#catalogPage').textContent=result.items.length?`${offset+1}–${end} sur ${Number(result.total).toLocaleString('fr-FR')}`:'';
        $('#catalogPrev').disabled=offset===0;$('#catalogNext').disabled=end>=result.total;$('#catalogPagination').hidden=!result.items.length||result.total<=20;
      }catch(e){if(generation===this.generation){box.textContent=e.message||'Le catalogue est indisponible.';$('#catalogCount').textContent='';this.lastKey='';}}
      finally{if(generation===this.generation)$('#catalogSearch').disabled=false;}
    },
    async install(provider,project,installation,button){
      if(this.installing||!installation||!(this.profiles||[]).some(p=>p.id===installation))return;this.installing=true;button.disabled=true;button.textContent='Vérification…';
      try{
        const plan=await X.modCatalog.prepare(provider,project.id,installation);
        const accepted=await Dialog.open({title:'Installer '+project.title+' ?',html:`<p>Minecraft ${esc(plan.context.version)} · ${esc(plan.context.loader)} · ${human(plan.bytes)}</p><ul>${plan.files.map(f=>`<li>${esc(f.filename)}</li>`).join('')}</ul>`,ok:'Télécharger et installer',cancel:'Annuler'});
        if(!accepted)return;button.textContent='Téléchargement…';
        const result=await X.modCatalog.install(plan.token);Mods.renderList(result.mods);
        Toast.show('Mods installés',result.installed.length+' fichier(s). Disponibles au prochain lancement du jeu.','ok',6000);button.textContent='Installé';
      }catch(e){Toast.show('Installation impossible',e.message||String(e),'err',7000);}
      finally{this.installing=false;button.disabled=false;if(button.textContent!=='Installé')button.textContent='Installer';}
    }
  };
  $('#catalogForm').addEventListener('submit',event=>{event.preventDefault();if(DESKTOP)Catalog.search();});
  ['catalogInstallation','catalogSort'].forEach(id=>$('#'+id).addEventListener('change',()=>{Catalog.describe();if(DESKTOP)Catalog.search(0);}));
  $('#catalogPrev').addEventListener('click',()=>Catalog.search(Math.max(0,Catalog.offset-20)));
  $('#catalogNext').addEventListener('click',()=>Catalog.search(Catalog.offset+20));
  const btnModsFolder = $('#btnModsFolder');
  if (btnModsFolder) btnModsFolder.addEventListener('click', async () => {try{await api(x => x.mods.openFolder());}catch(error){Toast.show('Dossier des mods',error.message||'Ouverture impossible.','err');}});
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
      if (STATE.fsPath !== data.path) this.limit = 100;
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
        (data.entries.length ? '<div class="fs-grid">' + data.entries.slice(0, this.limit || 100).map(e => {
          const ico = e.dir ? 'i-folder' : e.icon === 'zip' ? 'i-save' : e.icon === 'jar' ? 'i-cube' : e.icon === 'json' ? 'i-list' : e.icon === 'image' ? 'i-palette' : 'i-list';
          return `<div class="fs-item ${e.dir ? 'dir' : ''}">
            <span class="fs-ico">${ic(ico, 17)}</span>
            <span class="fs-info"><span class="fs-name" title="${esc(e.name)}">${esc(e.name)}</span>
              <span class="fs-sub">${e.dir ? 'Dossier' : human(e.size)} · ${relative(e.mtime)}</span></span>
            <span class="fs-act">
              ${e.dir ? `<button class="iconbtn" data-open-dir="${esc(e.path)}">${ic('i-folder', 15)}</button>` : ''}
              <button class="iconbtn" data-show="${esc(e.path)}">${ic('i-external', 15)}</button>
              <button class="iconbtn danger" data-rm="${esc(e.path)}">${ic('i-trash', 15)}</button>
            </span></div>`;
        }).join('') + '</div>' : '<p class="empty">Dossier vide.</p>');

      if (data.entries.length > (this.limit || 100)) {
        const more = document.createElement('button'); more.className = 'btn';
        more.textContent = 'Afficher 100 éléments de plus';
        more.onclick = () => { this.limit = (this.limit || 100) + 100; this.refresh(data.path); };
        body.appendChild(more);
      }
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
  async function refreshDownloadedVersions() {
    const list = await api(x => x.game.installed(), {soft:true}) || [];
    const box=$('#dlInstalled'); if(!box)return;
    box.innerHTML=list.length ? list.map(v=>`<div class="row"><span class="nm">${esc(v.id)}<small style="display:block;color:var(--dim)">${v.loader ? esc(v.loader.nom) : 'Minecraft'} · ${human(v.size)}</small></span><span class="tag inst">Téléchargée</span><button class="btn sm" data-dl-select="${esc(v.id)}">Sélectionner</button></div>`).join('') : '<p class="empty">Aucune version téléchargée. Choisis une version dans Installations.</p>';
    $$('[data-dl-select]',box).forEach(b=>b.onclick=()=>{Version.select(b.dataset.dlSelect);Nav.go('home');});
  }
  const Servers = {
    async refresh() {
      const list = await api(x => x.servers.list(), { soft: true }) || [];
      const box = $('#serverList');
      box.innerHTML = list.length ? list.map(s => `
        <div class="srv" data-srv="${esc(s.host)}|${s.port}">
          <span class="srv-ico">${s.icon ? `<img alt="" src="${esc(s.icon)}">` : ic('i-globe', 21)}</span>
          <span class="srv-main"><span class="srv-name">${esc(s.name)}</span>
            <span class="srv-mot" data-mot>${esc(s.host)}:${s.port} — test de connexion…</span></span>
          <span class="srv-side"><span class="srv-ping" data-ping>…</span><span class="srv-count" data-count></span></span>
          <button class="btn sm" data-copy-srv="${esc(s.host)}${s.port===25565?'':':'+s.port}">Copier l’IP</button>
          <button class="btn sm danger" data-del-srv="${esc(s.host)}|${s.port}">Retirer</button>
        </div>`).join('') : '<p class="empty">Aucun serveur enregistré. Ajoutez une adresse ci-dessus.</p>';
      $$('[data-del-srv]', box).forEach(b => b.addEventListener('click', () => {
        const [h, p] = b.dataset.delSrv.split('|');
        api(x => x.servers.remove(h, p)).then(() => this.refresh());
      }));
      $$('[data-copy-srv]',box).forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copySrv);Toast.show('Adresse copiée',b.dataset.copySrv,'ok');}catch{Toast.show('Adresse du serveur',b.dataset.copySrv,'info',7000);}});
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
      if (cnt) cnt.textContent = st.players + (st.maxPlayers>0 ? ' / '+st.maxPlayers : '') + ' joueurs';
      if (st.favicon) { const img=document.createElement('img'); img.alt=''; img.src=st.favicon; row.querySelector('.srv-ico').replaceChildren(img); }
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

    /* --- Choix du mode de connexion --------------------------------
        "minecraft" : chaine complete, exige l'approbation de Mojang.
        "xbox"      : on s'arrete a Xbox Live, aucune approbation
                       necessaire ; le jeu tourne en mode hors-ligne
                       sous le vrai gamertag.                          */
    /*  Un seul mode : le vrai compte Minecraft. Le mode Xbox
        avait ete ajoute quand Mojang refusait l\'application ;
        il n\'a plus lieu d\'etre, l\'application declaree est la
        bonne. Le launcher ne joue donc plus en hors-ligne avec un
        pseudo choisi a la main : il utilise le compte reel.      */
    mode: 'minecraft',
    setMode(mode) { this.mode = (mode === 'xbox') ? 'xbox' : 'minecraft'; },

    /* --- Microsoft : code d'appareil -------------------------------- */
    async start() {
      if(this.starting)return;
      this.starting=true;
      this.stopPolling();
      try {
      document.getElementById('msCard').hidden = false;
      document.getElementById('msCode').hidden = false;
      document.getElementById('msSub').textContent = "Une fen\u00eatre va s'ouvrir dans ton navigateur.";
      await api(x => x.auth.setMode(this.mode), { soft: true });
      const res = await api(x => x.auth.begin());
      if (!res) {
        document.getElementById('msCode').hidden = true;
        return;
      }
      document.getElementById('userCode').textContent = res.userCode;
      if(res.provider){document.getElementById('msCode').hidden=true;document.getElementById('msSub').textContent='Termine la connexion dans la fenêtre Microsoft. XRN récupérera ton pseudo et ton skin Minecraft.';}
      this.poll(res);
      } finally {this.starting=false;}
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
      const generation=this.pollGeneration;

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
          const r = await X.auth.poll();
          if (generation!==this.pollGeneration || !r || !r.done) return;
          termine = true;
          this.stopPolling();
          if (bar) bar.style.width = '100%';
          document.getElementById('waitText').textContent = 'R\u00e9cup\u00e9ration de ton profil\u2026';
          let done = null;
          try { done = await X.auth.finish(r.tokens); }
          catch (e) { await this.onAuthError(e); return; }
          if (!done) return;
          /*  Microsoft verifie l'identite mais ne livre pas le pseudo :
              on demande donc a l'utilisateur le nom sous lequel jouer.  */
          if (done.needsName) {
            document.getElementById('waitText').textContent = 'Choisis ton pseudo…';
            const nom = await demanderPseudo(done.xuid);
            if (!nom) {
              Toast.show('Connexion annulée', 'Aucun pseudo choisi : session Xbox fermée.', 'warn', 6000);
              return;
            }
            try { done = await X.auth.chooseName(nom); }
            catch (e) { await this.onAuthError(e); return; }
          }
          Account.apply(done.account);
          Toast.show('Connecté', done.account.name, 'ok');
          this.refresh();
        } catch (e) {
          if(generation!==this.pollGeneration)return;
          termine = true;
          this.stopPolling();
          await this.onAuthError(e);
        } finally {
          enCours = false;
        }
      }, 5000);
    },

    stopPolling() {
      this.pollGeneration=(this.pollGeneration||0)+1;
      if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
      if (this.barTimer) { clearInterval(this.barTimer); this.barTimer = null; }
    },

        async onAuthError(e) {
      const msg = String((e && (e.body || e.message)) || e || '');
      if(e?.code==='mc'||e?.diagnostic?.stage==='minecraft-login'||/Invalid app registration|AppRegInfo/i.test(msg)) {
        this.stopPolling();
        const d=e.diagnostic||await X.auth.diagnostic();
        const report=d ? ['XRN '+(X.version||''),'Date UTC : '+d.at,'Étape : '+d.stage,'HTTP : '+d.status,'Application : '+d.clientId,'Réponse : '+d.reason,d.requestId?'Requête : '+d.requestId:''].filter(Boolean).join('\n') : msg;
        const registration=/Invalid app registration|AppRegInfo/i.test(d?.reason||msg);
        const waiting=Dialog.alert({kind:'warn',title:'Minecraft refuse la connexion',html:
          '<p>Microsoft et Xbox ont répondu, mais la création de la session Minecraft a échoué'+(d?' (HTTP '+esc(d.status)+')':'')+'.</p>'+
          '<pre style="white-space:pre-wrap;max-height:180px;overflow:auto">'+esc(d?.reason||msg)+'</pre>'+
          (registration?'<p>L’identifiant n’a pas été remplacé. Si Mojang a confirmé cet identifiant précis, ce diagnostic permettra de leur transmettre le refus actuel.</p>':'<p>Le diagnostic conserve le code exact pour identifier le problème, sans mot de passe ni jeton.</p>')+
          '<button class="btn" id="copyAuthDiagnostic">Copier le diagnostic</button>',ok:'Fermer'});
        document.getElementById('copyAuthDiagnostic').onclick=async()=>{try{await navigator.clipboard.writeText(report);Toast.show('Diagnostic copié','Aucun mot de passe ni jeton inclus.','ok');}catch{Toast.show('Copie impossible','Le diagnostic est enregistré dans le dossier du launcher.','warn');}};
        await waiting;this.reset();return;
      }
      Toast.show('Connexion refusée', msg.slice(0, 220), 'err', 7000);
    },

    async refresh() {
      this.reset();
      this.renderCurrent();
      const accounts = await api(x => x.auth.accounts(), { soft: true }) || [];
      const card = document.getElementById('accountsCard');
      card.hidden = false;
      const list = document.getElementById('accountsList');
      list.innerHTML = accounts.map(a =>
        '<div class="acc-item">' +
        '<span class="av"><canvas data-acc-id="' + esc(a.id) + '" width="80" height="80"></canvas></span>' +
        /*  On montre le pseudo MINECRAFT en grand, et le gamertag
            Xbox a cote : deux noms pour un seul compte, c est
            precisement ce qui aide l'utilisateur.                        */
        '<span class="ai"><span class="an">' + esc(a.name) +
        (a.gamertag && a.gamertag !== a.name ? ' <span class="ag">' + esc(a.gamertag) + '</span>' : '') +
        '</span><span class="au">' + esc(a.id) + '</span></span>' +
        '<span class="acc-type">' + (a.type === 'offline' ? 'Solo' : (a.minecraftVerified ? 'Minecraft' : 'À reconnecter')) + '</span>' +
        '<button class="btn sm" data-use-acc="' + esc(a.id) + '">Changer</button>' +
        '<button class="btn sm danger" data-rm-acc="' + esc(a.id) + '">Supprimer</button>' +
        '</div>').join('') || '<p class="empty">Aucun compte enregistré sur ce PC. Les comptes ajoutés apparaîtront ici pour changer de profil.</p>';
      $$('[data-acc-id]', list).forEach(cv => {
        const a = accounts.find(x => x.id === cv.dataset.accId);
        SkinHead.draw(cv, a.skinUrl, a.name, a.avatarUrl);
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
      const help=document.getElementById('loginHelpState');
      if(help)help.textContent=!acc?'Connectez votre compte pour retrouver votre pseudo et votre skin.':acc.type==='offline'?'Profil solo actif. Connectez Microsoft pour utiliser votre compte Minecraft en ligne.':acc.minecraftVerified?'Profil Minecraft chargé. La session sera vérifiée avant chaque lancement.':'La session Minecraft doit être renouvelée.';
      const s3 = document.getElementById('loginStep3');
      if (!s3) return;
      if (!acc) {
        s3.hidden = false;
        s3.innerHTML='<div class="connected login-empty-profile"><div class="big-avatar"><canvas id="emptyProfileHead" width="120" height="120"></canvas></div><div><div class="cname">Non connecté</div><p class="session-caption">Choisissez votre compte Microsoft ou un profil solo.</p></div><div class="session-details"><span>Session</span><b>Aucune session active</b><span>Skin</span><b>Alex · aperçu par défaut</b></div></div>';
        SkinHead.draw(document.getElementById('emptyProfileHead'),'','','');
        return;
      }
      s3.hidden = false;
      s3.innerHTML = '<div class="connected">' +
        '<div class="big-avatar"><canvas id="bigAvatar" width="120" height="120"></canvas></div>' +
        '<div><div class="cname">' + esc(acc.name) + '</div>' +
        '<p class="session-caption">' + (acc.type === 'offline' ? 'Profil local · solo et LAN' : (acc.minecraftVerified ? 'Session Minecraft authentifiée' : 'Connexion Minecraft à renouveler')) + '</p></div>' +
        '<button class="btn primary" id="btnPlayFromAcc">Jouer</button>' +
        '<dl class="session-details"><div><dt>Profil</dt><dd>'+esc(acc.name)+'</dd></div><div><dt>Type de session</dt><dd>'+(acc.type==='offline'?'Solo et LAN':acc.minecraftVerified?'Minecraft Java':'À reconnecter')+'</dd></div></dl></div>';
      SkinHead.draw(document.getElementById('bigAvatar'), acc.skinUrl, acc.name, acc.avatarUrl);
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

  /* ---------- Mise a jour : le grand voile ---------- */
  /*  Il reste a l ecran tant que la mise a jour n est pas finie, et
      il montre ce qui a ete telecharge, le total et le temps passe.  */
  const maj = {
    debut: 0,
    timer: null,
    ouvrir(version) {
      const v = $('#majVoile');
      if (!v) return;
      this.debut = Date.now();
      v.hidden = false;
      const t = $('#majTitre');
      if (t) t.textContent = 'Mise a jour vers la v' + version;
      const x = $('#majTexte');
      if (x) x.textContent = 'Telechargement de la nouvelle version...';
      this.temps();
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => this.temps(), 500);
    },
    temps() {
      const e = $('#majTemps');
      if (e) e.textContent = Math.floor((Date.now() - this.debut) / 1000) + ' s';
    },
    progr(d) {
      const recues = d.recues || 0;
      const total = d.total || 0;
      const pct = total ? Math.min(100, Math.round(recues / total * 100)) : 25;
      const b = $('#majBarre');
      if (b) b.style.width = pct + '%';
      const det = $('#majDetail');
      if (det) {
        det.textContent = (recues / 1048576).toFixed(1) + ' Mo'
          + (total ? ' sur ' + (total / 1048576).toFixed(1) + ' Mo' : '');
      }
      if (d.fini) {
        const t = $('#majTexte');
        if (t) t.textContent = 'Installation... le launcher va se relancer.';
        const b2 = $('#majBarre');
        if (b2) b2.style.width = '100%';
      }
    },
    fermer() {
      const v = $('#majVoile');
      if (v) v.hidden = true;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }
  };
  if (DESKTOP) X.on('maj:progression', d => maj.progr(d));
  onClick('majAnnuler', () => {
    api(x => x.env.annulerMaj(), { soft: true });
    maj.fermer();
    Toast.show('Mise a jour annulee', '', 'warn', 3000);
  });

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
      /*  On montre l identifiant de l application en cours, masque.
          Le champ reste modifiable : sur une distribution publique,
          chacun declare sa propre application Azure.                  */
      const clientId = await api(x => x.auth.clientIdUsed(), { soft: true });
      const champ = $('#setClientId');
      if (champ) champ.value = (cfg.workingClientId || '').trim();
      const astuce = $('#clientIdHint');
      if (astuce && clientId) {
        astuce.innerHTML = clientId.configure
          ? 'Application en cours : <b class="mono">' + clientId.masque + '</b>' +
            (clientId.personnel ? ' (la tienne)' : ' (celle du launcher)') +
            '. Vide pour revenir a celle du launcher.'
          : 'Aucune application configuree : colle un identifiant Azure pour pouvoir te connecter.';
      }
      $('#setJavaArgs').value = cfg.javaArgs || '';
      $('#setGw').value = cfg.gameWidth; $('#setGh').value = cfg.gameHeight;
      $('#setGui').value = String(cfg.guiScale || 3);
      setRange('#setRam', cfg.ramGB, 1, 32);
      $('#setRamVal').textContent = cfg.ramGB + ' Go';
      $('#stRam').innerHTML = esc(cfg.ramGB) + '<small>Go</small>';
      $$('[data-ram]').forEach(b => b.classList.toggle('on', Number(b.dataset.ram) === Number(cfg.ramGB)));

      $('#dlConc').textContent = cfg.maxDownloads; $('#dlConcVal').textContent = cfg.maxDownloads;
      $$('[data-switch]').forEach(s => {
        const key = s.dataset.switch;
        if (key in cfg) {s.classList.toggle('on', !!cfg[key]);s.setAttribute('aria-checked',String(!!cfg[key]));}
      });
      const technicalId=await api(x=>x.env.installationId(),{soft:true});
      if(technicalId)$("#technicalInstallationId").textContent=technicalId;
      renderQuickLinks(cfg);
    },
    openJavaHelp(detail) {
      Nav.go('settings');
      const hint = $('#javaHint');
      if (hint && detail) hint.innerHTML = 'Java ' + detail.need + '+ requis. <a href="#" id="dlJavaLink" style="color:var(--v2)">Télécharger Temurin</a>';
      if (hint && detail) $('#dlJavaLink').addEventListener('click', e => { e.preventDefault(); api(x => x.env.openUrl(detail.url)); });
    },
    async save(patch) {
      const saved = await api(x => x.env.saveConfig(patch));
      const status = $('#settingsSaved');
      if (status) status.textContent = saved ? 'Modifications enregistrées' : 'Enregistrement impossible';
      return saved;
    }
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
  /*  On enregistre sur "input" (chaque mouvement) et sur "change"
      (quand le controle est relache) : le reglage est ainsi ecrit
      dans tous les cas, meme si on quitte la fenetre vite.      */
  $('#setRam').addEventListener('change', e => {
    Settings.save({ ramGB: parseFloat(e.target.value) });
  });

  $$('[data-ram]').forEach(c => c.addEventListener('click', () => {
    const v = parseFloat(c.dataset.ram);
    setRange('#setRam', v, 1, 32);
    $('#setRamVal').textContent = v + ' Go';
    $('#stRam').innerHTML = v + '<small>Go</small>';
    $$('[data-ram]').forEach(x => x.classList.toggle('on', x === c));
    Settings.save({ ramGB: v });
  }));

  $('#btnCheckUpdates').addEventListener('click',async()=>{
    const button=$('#btnCheckUpdates'),label=$('#updateState');button.disabled=true;label.textContent='Vérification…';
    try{const result=await X.env.chercherMiseAJour();miseAJourInfo=result;miseAJourPromise=null;miseAJourVue=false;label.textContent=result.ok?'XRN '+result.version+' disponible · '+human(result.taille)+' à télécharger.':!result.version?'Le service de mise à jour ne répond pas. Réessaie plus tard.':result.version===result.courant?'XRN '+result.courant+' est à jour.':'Version locale '+result.courant+' · dernière version publique '+result.version+'.';if(result.ok)verifierMiseAJour();}
    catch{label.textContent='Vérification indisponible.';}finally{button.disabled=false;}
  });
  $('#setGw').addEventListener('change', e => Settings.save({ gameWidth: +e.target.value || 1280 }));
  $('#setGh').addEventListener('change', e => Settings.save({ gameHeight: +e.target.value || 720 }));
  $('#setGui').addEventListener('change', e => Settings.save({ guiScale: +e.target.value }));
  $('#setJavaArgs').addEventListener('change', e => Settings.save({ javaArgs: e.target.value }));
  $('#setJava').addEventListener('change', e => Settings.save({ javaPath: e.target.value.trim() }));

  /*  Identifiant d application Azure : c est ce qui permet a une
      distribution publique de fonctionner sans imposer l application
      de l auteur. Un identifiant erronee est refuse par Microsoft, on
      verifie donc avant d enregistrer.                                */
  $('#btnSaveClientId').addEventListener('click', async () => {
    const valeur = ($('#setClientId').value || '').trim();
    if (valeur) {
      const verdict = await api(x => x.auth.check(valeur), { soft: true });
      if (verdict && verdict.ok === false) {
        Toast.show('Identifiant refuse', verdict.message || 'Microsoft ne reconnait pas cet identifiant.', 'err', 7000);
        return;
      }
    }
    try {
      await api(x => x.auth.setClientId(valeur), { soft: true });
      Toast.show(valeur ? 'Identifiant enregistre' : 'Identifiant efface',
        valeur ? 'Il sera utilise des la prochaine connexion.' : 'Le launcher reprendra son identifiant par defaut.',
        'ok', 3200);
      Settings.refresh();
    } catch (e) {
      Toast.show('Erreur', String((e && e.message) || e).slice(0, 200), 'err', 6000);
    }
  });
  $('#copyTechnicalId').addEventListener('click',async()=>{const id=await api(x=>x.env.installationId(),{soft:true});if(!id)return;try{await navigator.clipboard.writeText(id);Toast.show('Identifiant copié','Identifiant technique de cette installation.','ok');}catch{Toast.show('Identifiant',id,'info',10000);}});
  $$('[data-switch]').forEach(s => s.addEventListener('click', () => {
    s.classList.toggle('on');s.setAttribute('aria-checked',String(s.classList.contains('on')));
    const patch = {}; patch[s.dataset.switch] = s.classList.contains('on');
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
  /* ---------- RECHERCHE DE L ENTETE ---------- */
  /*  Ce champ etait present mais sans aucun gestionnaire : on pouvait
      taper dedans sans qu il se passe quoi que ce soit. Il cherche
      maintenant dans les sauvegardes, les versions installees et les
      mods, et un clic sur un resultat ouvre le bon onglet.        */
  const Recherche = {
    minuteur: null,

    async lance(q) {
      const pop = $('#searchPop');
      const t = String(q || '').trim().toLowerCase();
      if (t.length < 2) { pop.hidden = true; pop.innerHTML = ''; return; }

      const groupes = [];
      const contient = (v) => String(v || '').toLowerCase().indexOf(t) !== -1;

      const saves = STATE.saves || [];
      const dansSaves = saves.filter(s => contient(s.folder) || contient(s.name));
      if (dansSaves.length) {
        groupes.push({ vue: 'saves', titre: 'Sauvegardes', items: dansSaves.slice(0, 6)
          .map(s => ({ texte: s.folder || s.name, meta: s.lastPlayed ? relative(s.lastPlayed) : '' })) });
      }

      const versions = STATE.installed || [];
      const dansVersions = versions.filter(v => contient(v.id));
      if (dansVersions.length) {
        groupes.push({ vue: 'versions', titre: 'Versions', items: dansVersions.slice(0, 6)
          .map(v => ({ texte: v.id, meta: v.type === 'snapshot' ? 'snapshot' : 'release' })) });
      }

      const etat = await api(x => x.mods.etat(), { soft: true });
      const mods = (etat && etat.mods) || [];
      const dansMods = mods.filter(m => contient(m.name) || contient(m.fichier));
      if (dansMods.length) {
        groupes.push({ vue: 'mods', titre: 'Mods', items: dansMods.slice(0, 6)
          .map(m => ({ texte: m.name || m.fichier, meta: '.jar' })) });
      }

      if (!groupes.length) {
        pop.innerHTML = '<div class="sr-empty">Aucun resultat pour « ' + esc(t) + '»</div>';
        pop.hidden = false;
        return;
      }

      let html = '';
      for (const g of groupes) {
        html += '<div class="sr-grp"><div class="sr-t">' + esc(g.titre) + '</div>';
        for (const i of g.items) {
          html += '<button class="sr-i" data-sr-vue="' + esc(g.vue) + '">' +
                  '<span class="sr-n">' + esc(i.texte) + '</span>' +
                  (i.meta ? '<span class="sr-m">' + esc(i.meta) + '</span>' : '') +
                '</button>';
        }
        html += '</div>';
      }
      pop.innerHTML = html;
      pop.hidden = false;
    },

    fermer() { const pop = $('#searchPop'); if (pop) pop.hidden = true; }
  };

  (function () {
    const champ = $('#searchInput');
    const pop = $('#searchPop');
    if (!champ || !pop) return;

    champ.addEventListener('input', () => {
      clearTimeout(Recherche.minuteur);
      Recherche.minuteur = setTimeout(() => Recherche.lance(champ.value), 180);
    });

    champ.addEventListener('keydown', e => {
      if (e.key === 'Escape') { champ.value = ''; Recherche.fermer(); champ.blur(); return; }
      if (e.key === 'Enter') {
        const premier = pop.querySelector('.sr-i');
        if (premier) premier.click();
      }
    });

    pop.addEventListener('click', e => {
      const b = e.target.closest('[data-sr-vue]');
      if (!b) return;
      Recherche.fermer();
      champ.value = '';
      Nav.go(b.dataset.srVue);
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('.title-search') && !e.target.closest('#searchPop')) Recherche.fermer();
    });
  })();

  /* ---------- fenetre (via window.nw, contexte DOM) ---------- */
  function nwWin() { try { return (window.nw && window.nw.Window) ? window.nw.Window.get() : null; } catch (e) { return null; } }
  $('#winMin').addEventListener('click', () => {
    const w = nwWin();
    if (w) w.minimize(); else Toast.show('Reduire', 'Disponible uniquement dans l application.', 'info', 2000);
  });
  let maximized=false;const nativeWindow=nwWin();
  if(nativeWindow){nativeWindow.on('maximize',()=>{maximized=true;X.env.saveConfig({windowMaximized:true});});nativeWindow.on('unmaximize',()=>{maximized=false;X.env.saveConfig({windowMaximized:false});});const width=Math.max(800,Math.min(1440,screen.availWidth-32)),height=Math.max(480,Math.min(860,screen.availHeight-32));nativeWindow.setMinimumSize(Math.min(1000,width),Math.min(560,height));nativeWindow.resizeTo(width,height);nativeWindow.moveTo((screen.availLeft||0)+Math.round((screen.availWidth-width)/2),(screen.availTop||0)+Math.round((screen.availHeight-height)/2));if(X.env.config().windowMaximized)nativeWindow.maximize();}
  $('#winMax').addEventListener('click',()=>{const w=nwWin();if(!w)return;if(maximized)w.unmaximize();else w.maximize();});
  $('#winClose').addEventListener('click', () => { const w = nwWin(); if (w) w.close(); else window.close(); });

  /* Toute erreur de l interface atterrit dans les journaux -------------- */
  addEventListener('error', e => {
    if (DESKTOP) X.report('UI-ERREUR', e.message + ' @ ' + String(e.filename || '').split(/[\\/]/).pop() + ':' + e.lineno);
  });
  addEventListener('unhandledrejection', e => { if (DESKTOP) X.report('UI-REJET', e.reason); });
  addEventListener('beforeunload', () => { if (DESKTOP) X.report('FENETRE', 'document unload'); });
  addEventListener('visibilitychange', () => { if (DESKTOP) X.report('FENETRE', 'visibilite=' + document.visibilityState); });
  if (DESKTOP) {
      X.report('UI', 'interface chargee');
      /*  Une trace toutes les cinq minutes : assez pour savoir que
          l application vit, sans remplir le disque de lignes. */
      setInterval(() => X.report('PING', 'actif'), 300000);
    }

  /* ================================================================== *
   *  HORLOGE + HELPERS
   * ================================================================== */
  (function clock() {
    const el = $('#clock');
    const t = () => { const d = new Date(); el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    t();
    /*  Une horloge n a rien a faire dans une fenetre masquee : elle est
        mise en pause pour de bon, et remise a l heure juste en sortant. */
    let minuteur = setInterval(t, 10000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { clearInterval(minuteur); minuteur = null; }
      else if (!minuteur) { t(); minuteur = setInterval(t, 10000); }
    });
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
  (async function boot() {
    Splash.boot();
    if (DESKTOP) {
      $('#brandTag').textContent = 'v' + X.version;
    /*  On regarde si une version plus recente est publiee. Le test ne
        bloque rien et n affiche rien s il n y a pas de reseau.     */
    verifierMiseAJour();
    verifierNotification();
      Account.watch();
      // on laisse le launcher s'afficher tout de suite, puis on reconnecte
      Account.apply(null);
      Settings.refresh();
      /*  L'etat du mode Profil FPS Plus, pour que le bouton d'accueil
          dise la verite des le premier affichage.                      */
      api(x => x.env.config(), { soft: true }).then(c => { if (c) majEtatBoost(c); });
      const acc = await X.auth.resume();
      Account.apply(acc);
      await Home.refresh();
      if (!acc) { Nav.go('login'); }
      else Nav.go((location.hash || '#/home').replace('#/', ''));
      Home.refresh();
      Splash.ready();
    } else {
      $('#brandTag').textContent = 'aperçu navigateur';
      const view = $('#view-home');
      view.insertAdjacentHTML('afterbegin',
        `<div class="banner">${ic('i-alert', 18)}<div><b>Mode aperçu.</b> Les fonctions système (téléchargement, fichiers, Java) ne sont actives que dans l'application Windows.</div></div>`);
      Account.apply(null);
      STATE.installed = [];
      STATE.catalog = { latest: {}, versions: [] };
      Version.renderList();
      Mods.renderIntegre([]);
    }
    Splash.ready();


  })();
})();

