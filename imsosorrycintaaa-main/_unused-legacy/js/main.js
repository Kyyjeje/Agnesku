/* ============================================================
   IN FULL BLOOM — main.js
   A canvas particle engine (physics, pooling, layered depth,
   sprite batching, adaptive quality) + a timeline-driven intro,
   plus the site's interaction layer (nav, gallery, playlist,
   countdown, confetti).
============================================================ */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverCapable = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const clamp = (v,a,b) => Math.min(b, Math.max(a,v));
  const rand  = (a,b) => a + Math.random()*(b-a);

  /* ============================================================
     CONFIG — the one place that owns tunable numbers so they
     don't live scattered as magic values through every subsystem.
     Anything a future edit is likely to touch (the birthday date,
     audio fade timing) reads from here.
  ============================================================ */
  const CONFIG = {
    audio: {
      storeKey: 'nabila-garden-song-state',
      fadeMs: 900,
      targetVolume: 0.85,
      saveIntervalMs: 4000,
    },
    countdown: {
      nextBirthday: (() => {
        const today = new Date();
        return new Date(today.getFullYear()+1, today.getMonth(), today.getDate());
      })(),
    },
  };

  /* ============================================================
     DEVICE TIER — conservative up front, then adapts live from
     measured frame time so low-end devices settle to something
     smooth instead of staying maxed out and janky.
  ============================================================ */
  const TIERS = {
    minimal: { bg:0,  mid:5,  fg:0, dpr:1,   blur:false },
    low:     { bg:8,  mid:10, fg:3, dpr:1,   blur:false },
    medium:  { bg:16, mid:16, fg:5, dpr:1.5, blur:true  },
    high:    { bg:26, mid:22, fg:7, dpr:2,   blur:true  },
  };
  const order = ['minimal','low','medium','high'];
  let tierName = (() => {
    if (reduceMotion) return 'minimal';
    const cores = navigator.hardwareConcurrency || 4;
    const mem   = navigator.deviceMemory || 4;
    const mobile = matchMedia('(max-width:700px)').matches;
    if (mobile && (cores <= 4 || mem <= 4)) return 'low';
    if (cores <= 4 || mem <= 4) return 'medium';
    return 'high';
  })();

  /* ============================================================
     SPRITE CACHE — pre-render petal shapes once, reuse via
     drawImage (sprite batching) instead of re-stroking paths
     for every particle on every frame.
  ============================================================ */
  const SPRITE_SIZE = 64;
  // Curated, not just the raw emoji list from the brief: cherry blossom,
  // tulip, blossom and lotus read as soft/elegant at small sizes and are
  // weighted heaviest; rose is a touch more saturated so it's rarer;
  // hibiscus and the bouquet are the busiest glyphs, so they only ever
  // appear as occasional accents rather than the norm.
  const EMOJI_SET = [
    { ch:'🌸', w:9 }, { ch:'🌷', w:6 }, { ch:'🌼', w:6 }, { ch:'🪷', w:5 },
    { ch:'🌹', w:3 }, { ch:'🌺', w:2 }, { ch:'💐', w:1 },
  ];
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  function makeSprite(ch){
    const s = SPRITE_SIZE * 2;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const cx = c.getContext('2d');
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.font = `${s*0.7}px ${EMOJI_FONT}`;
    // a soft glow pass first — ties the glyph into the site's ambient
    // lighting instead of it sitting flat on top like clip-art
    cx.shadowColor = 'rgba(255,190,210,.5)';
    cx.shadowBlur = s*0.14;
    cx.fillText(ch, s/2, s/2 + s*0.02);
    // crisp core pass on top, no shadow
    cx.shadowBlur = 0;
    cx.fillText(ch, s/2, s/2 + s*0.02);
    return c;
  }
  const spriteCache = new Map(EMOJI_SET.map(e => [e.ch, makeSprite(e.ch)]));
  const weightedEmoji = EMOJI_SET.flatMap(e => Array(Math.round(e.w*4)).fill(e.ch));
  // per-layer "don't repeat the same flower twice in a row" memory
  function makePicker(){
    let last1 = null, last2 = null;
    return () => {
      let ch, tries = 0;
      do { ch = weightedEmoji[(Math.random()*weightedEmoji.length)|0]; tries++; }
      while ((ch === last1 || ch === last2) && tries < 6);
      last2 = last1; last1 = ch;
      return spriteCache.get(ch);
    };
  }

  /* ============================================================
     PARTICLE — real physics: velocity, acceleration, gravity,
     wind (per-particle phase so nothing moves in sync), drag,
     rotation, depth scale.
  ============================================================ */
  class Petal {
    constructor(){ this.active = false; }
    spawn(o){
      this.active   = true;
      this.x = o.x; this.y = o.y;
      this.vx = o.vx || 0; this.vy = o.vy || 0;
      this.gravity  = o.gravity ?? 0.05;
      this.drag     = o.drag ?? 0.99;
      this.rot      = Math.random()*Math.PI*2;
      this.vrot     = (Math.random()-.5) * (o.spin ?? 0.025);
      this.scale    = o.scale ?? rand(0.4,1.1);
      this.sprite   = o.sprite;
      this.age      = 0;
      this.maxLife  = o.maxLife ?? Infinity;
      this.phase    = Math.random()*Math.PI*2;
      this.freq     = rand(0.0006, 0.0016);
      this.opacity  = o.opacity ?? rand(0.45,0.9);
      this.recycle  = o.recycle !== false;
      this.fadeInMs = o.fadeIn ?? 900;

      // a small mix of "personalities" so the field never reads as one
      // algorithm repeated — most flowers just drift; a minority rise,
      // loop gently, or pause mid-air, each on its own private phase.
      const r = Math.random();
      this.behavior   = r < 0.10 ? 'riser' : r < 0.20 ? 'circler' : r < 0.28 ? 'pauser' : 'drift';
      this.circlePhase = Math.random()*Math.PI*2;
      this.circleFreq  = rand(0.0015, 0.003);
      this.pausePhase  = Math.random()*Math.PI*2;
      this.pauseFreq   = rand(0.0007, 0.0015);
      this.breathes    = Math.random() < 0.35;
      this.breathePhase= Math.random()*Math.PI*2;
      this.breatheFreq = rand(0.0009, 0.0018);
    }
    step(dt, gust, W, H){
      this.age += dt;
      if (this.age > this.maxLife){ this.active = false; return; }
      const f = dt/16.7;
      // organic per-particle wind — sum of its own phase/frequency,
      // never synchronized with any other flower
      const wind = Math.sin(this.age*this.freq + this.phase) * 0.35 + gust;
      this.vx += wind * 0.02 * dt;
      this.vy += this.gravity * 0.02 * dt;

      let dragMul = 1;
      if (this.behavior === 'riser' && this.age < 750){
        // a brief lift before gravity takes over, like it's caught a thermal
        this.vy -= 0.05 * f;
      } else if (this.behavior === 'circler'){
        // a gentle private orbit layered on top of the drift
        this.vx += Math.cos(this.age*this.circleFreq + this.circlePhase) * 0.03 * f;
        this.vy += Math.sin(this.age*this.circleFreq + this.circlePhase) * 0.022 * f;
      } else if (this.behavior === 'pauser'){
        // hovers for a moment, then continues — extra drag only near
        // the peak of its own private cycle, so pauses never sync up
        if (Math.sin(this.age*this.pauseFreq + this.pausePhase) > 0.86) dragMul = 0.82;
      }

      this.vx *= Math.pow(this.drag*dragMul, f);
      this.vy *= Math.pow(this.drag*dragMul, f);
      this.x += this.vx * f;
      this.y += this.vy * f;
      this.rot += this.vrot * f;

      if (this.recycle){
        if (this.y - 60 > H){ this.y = -60; this.x = rand(0,W); this.vy = rand(0.3,0.9); this.vx = rand(-0.3,0.3); this.age = 0; }
        if (this.x < -80) this.x = W+80;
        else if (this.x > W+80) this.x = -80;
      } else if (this.y > H+100 || this.x < -100 || this.x > W+100){
        this.active = false;
      }
    }
    repel(mx,my,radius,force){
      const dx = this.x-mx, dy = this.y-my;
      const d2 = dx*dx+dy*dy;
      if (d2 > radius*radius || d2 < 1) return;
      const d = Math.sqrt(d2);
      const f = (1 - d/radius) * force;
      this.vx += (dx/d) * f;
      this.vy += (dy/d) * f;
    }
    draw(ctx){
      const s = SPRITE_SIZE*2*this.scale*0.5;
      const fadeIn = this.age < this.fadeInMs ? this.age/this.fadeInMs : 1;
      const breathe = this.breathes ? (0.85 + Math.sin(this.age*this.breatheFreq + this.breathePhase)*0.15) : 1;
      ctx.save();
      ctx.globalAlpha = this.opacity * fadeIn * breathe;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.drawImage(this.sprite, -s/2, -s/2, s, s);
      ctx.restore();
    }
  }

  /* ============================================================
     LAYER — a pooled canvas of particles at one depth. Object
     pooling avoids GC churn; only active particles are stepped
     and drawn.
  ============================================================ */
  class Layer {
    constructor(canvas, conf){
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha:true });
      this.conf = conf;
      this.pool = Array.from({length:56}, () => new Petal());
      this.pickSprite = makePicker();
      this.W = 0; this.H = 0;
      this.resize();
    }
    resize(){
      const dpr = Math.min(window.devicePixelRatio||1, this.conf.dpr);
      this.W = window.innerWidth; this.H = window.innerHeight;
      this.canvas.width  = Math.round(this.W*dpr);
      this.canvas.height = Math.round(this.H*dpr);
      this.ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    activeCount(){ let n=0; for(const p of this.pool) if(p.active) n++; return n; }
    ambientSpawn(anywhere){
      const p = this.pool.find(p=>!p.active);
      if (!p) return;
      p.spawn({
        x: rand(0,this.W),
        y: anywhere ? rand(0,this.H) : -60,
        vx: rand(-0.3,0.3),
        vy: rand(0.3,0.9) * this.conf.speed,
        gravity: 0.04 * this.conf.speed,
        drag: 0.992,
        scale: rand(this.conf.scaleMin, this.conf.scaleMax),
        opacity: rand(this.conf.opMin, this.conf.opMax),
        spin: 0.02,
        recycle: true,
        sprite: this.pickSprite(),
        fadeIn: anywhere ? 0 : rand(700,1300)
      });
    }
    fill(target, anywhere){
      const n = this.activeCount();
      for (let i=n;i<target;i++) this.ambientSpawn(anywhere);
    }
    burst(x,y,count,opts={}){
      let n = 0;
      for (const p of this.pool){
        if (n>=count) break;
        if (p.active) continue;
        const spread = opts.spread ?? Math.PI*0.7;
        const angle = -Math.PI/2 + rand(-spread/2, spread/2);
        const speed = rand(opts.minSpeed ?? 3, opts.maxSpeed ?? 8);
        p.spawn({
          x: x + rand(-20,20), y: y + rand(-10,10),
          vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
          gravity: opts.gravity ?? 0.14, drag: opts.drag ?? 0.985,
          scale: rand(0.5,1.2), opacity: rand(0.7,1),
          spin: 0.05, maxLife: opts.maxLife ?? 5200, recycle:false,
          sprite: this.pickSprite(), fadeIn: 0
        });
        n++;
      }
    }
    step(dt, gust, mouse){
      for (const p of this.pool){
        if (!p.active) continue;
        p.step(dt, gust, this.W, this.H);
        if (mouse && mouse.active) p.repel(mouse.x, mouse.y, mouse.radius, mouse.force);
      }
    }
    render(){
      const ctx = this.ctx;
      ctx.clearRect(0,0,this.W,this.H);
      for (const p of this.pool){ if (p.active) p.draw(ctx); }
    }
  }

  /* ============================================================
     ENGINE — orchestrates three depth layers, wind (ambient +
     scroll-reactive gusts), cursor interaction, and a live
     performance monitor that adapts particle counts to the
     device in real time.
  ============================================================ */
  const engine = {
    layers: {},
    gust: 0,
    mouse: { x:0, y:0, active:false, radius:130, force:0.55 },
    lastT: 0,
    frameSamples: [],
    running: false,
    mood: 1,       // current ambient density multiplier
    moodTarget: 1, // where it's lerping toward (set per-section on scroll)
    densityScale: 1, // scales with viewport area (see resize below)
    setMood(v){ this.moodTarget = v; },

    init(){
      const bgC  = document.getElementById('petal-bg');
      const midC = document.getElementById('petal-mid');
      const fgC  = document.getElementById('petal-fg');

      this.layers.bg  = new Layer(bgC,  { dpr:2, speed:0.6, scaleMin:0.3, scaleMax:0.55, opMin:0.18, opMax:0.35 });
      this.layers.mid = new Layer(midC, { dpr:2, speed:1,   scaleMin:0.55,scaleMax:0.95, opMin:0.35, opMax:0.6  });
      this.layers.fg  = new Layer(fgC,  { dpr:2, speed:1.5, scaleMin:0.9, scaleMax:1.4,  opMin:0.55, opMax:0.85 });

      const updateDensity = () => {
        this.densityScale = clamp((innerWidth*innerHeight)/(1440*900), 0.55, 1.65);
      };
      updateDensity();
      this.applyTier(tierName, true);
      window.addEventListener('resize', () => { Object.values(this.layers).forEach(l=>l.resize()); updateDensity(); });

      if (hoverCapable){
        window.addEventListener('mousemove', e => {
          this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.active = true;
        });
        window.addEventListener('mouseleave', () => this.mouse.active = false);
      }
    },

    applyTier(name, force){
      if (!force && name === tierName) return;
      tierName = name;
      const t = TIERS[name];
      this.layers.bg.canvas.style.filter  = t.blur ? 'blur(3px)' : 'none';
      this.layers.mid.canvas.style.filter = t.blur ? 'blur(1px)' : 'none';
      this.layers.bg.fill(Math.round(t.bg*this.densityScale), true);
      this.layers.mid.fill(Math.round(t.mid*this.densityScale), true);
      this.layers.fg.fill(Math.round(t.fg*this.densityScale), true);
    },

    burst(x,y,count,opts){
      // fountain bursts favour the mid + fg layers (closer, larger, faster)
      this.layers.mid.burst(x,y, Math.ceil(count*0.6), opts);
      this.layers.fg.burst(x,y, Math.floor(count*0.4), opts);
    },

    setGust(v){ this.gust = v; },

    start(){
      if (this.running) return;
      this.running = true;
      this.lastT = performance.now();
      requestAnimationFrame(this.tick.bind(this));
    },

    tick(now){
      const dt = Math.min(48, now - this.lastT || 16.7);
      this.lastT = now;

      // decay scroll gust back to ambient wind
      this.gust *= 0.94;
      // ease the ambient mood toward its target (calmer at the letter,
      // fuller at the finale) rather than snapping — this is what makes
      // the background itself feel like part of the story
      this.mood += (this.moodTarget - this.mood) * Math.min(1, dt/600);

      if (tierName !== 'minimal'){
        this.layers.bg.step(dt, this.gust*0.4, null);
        this.layers.mid.step(dt, this.gust*0.7, this.mouse);
        this.layers.fg.step(dt, this.gust, this.mouse);
        this.layers.bg.fill(Math.round(TIERS[tierName].bg*this.mood*this.densityScale), false);
        this.layers.mid.fill(Math.round(TIERS[tierName].mid*this.mood*this.densityScale), false);
        this.layers.fg.fill(Math.round(TIERS[tierName].fg*this.mood*this.densityScale), false);
        this.layers.bg.render();
        this.layers.mid.render();
        this.layers.fg.render();
      }

      // ---- live performance monitor: downgrade if sustained jank ----
      this.frameSamples.push(dt);
      if (this.frameSamples.length > 90) this.frameSamples.shift();
      if (this.frameSamples.length === 90){
        const avg = this.frameSamples.reduce((a,b)=>a+b,0)/90;
        const idx = order.indexOf(tierName);
        if (avg > 26 && idx > 0){ this.applyTier(order[idx-1]); this.frameSamples.length = 0; }
      }

      if (this.running) requestAnimationFrame(this.tick.bind(this));
    }
  };
  engine.init();
  engine.start();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden){ engine.running = false; }
    else if (!engine.running){ engine.start(); }
  });

  /* ============================================================
     SCROLL WIND — fast scrolling gives the petals a gust, like
     the page itself is stirring the air.
  ============================================================ */
  /* Scroll no longer stirs the flowers — it was making them dart
     around distractingly on fast scrolls. They keep their own gentle
     ambient drift (set per-particle in Petal.step) no matter how the
     page is scrolled. */

  /* ============================================================
     LENIS SMOOTH SCROLL — held during the intro, released after
  ============================================================ */
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ duration: 1.15, smoothTouch:false, touchMultiplier:1.4 });
  lenis.on('scroll', () => { ScrollTrigger.update(); });
  gsap.ticker.add((t)=> lenis.raf(t*1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();

  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const el = document.querySelector(a.getAttribute('href'));
      if (el) lenis.scrollTo(el, {offset:0, duration:1.3});
      closeIndex();
    });
  });

  /* ============================================================
     GARDEN INDEX (nav)
  ============================================================ */
  const bloomToggle = document.getElementById('bloomToggle');
  const gardenIndex  = document.getElementById('gardenIndex');
  const gardenIndexLinks = gardenIndex.querySelectorAll('a');
  const blockScrollLeak = (e) => e.preventDefault();
  function setIndexOpen(open){
    gardenIndex.classList.toggle('open', open);
    bloomToggle.classList.toggle('open', open);
    bloomToggle.setAttribute('aria-expanded', String(open));
    gardenIndex.setAttribute('aria-hidden', String(!open));
    gardenIndexLinks.forEach(a => a.tabIndex = open ? 0 : -1);
    // lock the page behind the full-screen index so scroll can never
    // leak through the overlay while it's open
    if (open){
      lenis.stop();
      gardenIndex.addEventListener('wheel', blockScrollLeak, {passive:false});
      gardenIndex.addEventListener('touchmove', blockScrollLeak, {passive:false});
    } else {
      lenis.start();
      gardenIndex.removeEventListener('wheel', blockScrollLeak);
      gardenIndex.removeEventListener('touchmove', blockScrollLeak);
    }
  }
  function closeIndex(){ setIndexOpen(false); }
  setIndexOpen(false);
  let toggleLocked = false;
  // the full-screen index now blooms outward from wherever the toggle
  // actually sits, so it stays visually anchored to the control that
  // opened it at every breakpoint instead of assuming a fixed corner
  function syncRevealOrigin(){
    const r = bloomToggle.getBoundingClientRect();
    const x = ((r.left + r.width/2) / innerWidth) * 100;
    const y = ((r.top + r.height/2) / innerHeight) * 100;
    gardenIndex.style.setProperty('--reveal-x', x + '%');
    gardenIndex.style.setProperty('--reveal-y', y + '%');
  }
  syncRevealOrigin();
  window.addEventListener('resize', syncRevealOrigin);
  bloomToggle.addEventListener('click', ()=>{
    if (toggleLocked) return; // guards against accidental double-taps mid-transition
    toggleLocked = true;
    syncRevealOrigin();
    setIndexOpen(!gardenIndex.classList.contains('open'));
    setTimeout(()=> toggleLocked = false, 900); // matches the clip-path transition
  });
  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape' && gardenIndex.classList.contains('open')) closeIndex();
  });

  /* ============================================================
     MAGNETIC CTA + trailing cursor petal
  ============================================================ */
  if (hoverCapable){
    document.querySelectorAll('[data-magnetic]').forEach(el=>{
      el.addEventListener('mousemove', e=>{
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left+r.width/2)) * .3;
        const dy = (e.clientY - (r.top+r.height/2)) * .4;
        gsap.to(el, {x:dx, y:dy, duration:.4, ease:'power2.out'});
      });
      el.addEventListener('mouseleave', ()=> gsap.to(el, {x:0,y:0,duration:.6,ease:'elastic.out(1,0.5)'}));
    });

    const cursor = document.getElementById('petalCursor');
    window.addEventListener('mousemove', e=>{
      cursor.classList.add('active');
      gsap.to(cursor, {x:e.clientX, y:e.clientY, duration:.5, ease:'power3.out'});
    });
  }

  /* ============================================================
     MICRO INTERACTION ENGINE — Motion One, used only for small,
     isolated feedback that CSS/GSAP don't already own. Every
     button touched here already has its own CSS or GSAP-driven
     transform (hover lift, magnetic pull, scale), so this engine
     deliberately animates a *different* property — a quick
     brightness pulse on press — rather than layering a second
     system on top of `transform` and fighting it for control.
     Degrades to nothing (buttons keep their existing CSS feedback)
     if the CDN didn't load.
  ============================================================ */
  (function initMicroInteractions(){
    const M = window.Motion;
    if (!M || typeof M.animate !== 'function') return;
    const { animate } = M;

    function glowPulse(el){
      if (!el) return;
      el.addEventListener('pointerdown', () => {
        animate(el, { filter:['brightness(1)','brightness(1.28)'] }, { duration:.15, easing:'ease-out' });
      });
      const release = () => animate(el, { filter:['brightness(1.28)','brightness(1)'] }, { duration:.45, easing:'ease-out' });
      el.addEventListener('pointerup', release);
      el.addEventListener('pointerleave', release);
    }
    [document.getElementById('confettiBtn'), document.getElementById('trackPlayBtn'), document.getElementById('bloomToggle')]
      .forEach(glowPulse);

    // countdown dials have no hover treatment of their own anywhere
    // else in the site, so Motion is free to own this one outright
    if (hoverCapable){
      document.querySelectorAll('.dial').forEach(d=>{
        d.addEventListener('mouseenter', () => animate(d, { y:-6 }, { duration:.4, easing:[0.22,1,0.36,1] }));
        d.addEventListener('mouseleave', () => animate(d, { y:0  }, { duration:.4, easing:[0.22,1,0.36,1] }));
      });
    }
  })();

  /* ============================================================
     TEXT ENGINE — SplitType-driven typography reveal. The hero
     name gets a character-level cascade timed to the intro
     handoff; every other heading gets a word-level reveal on
     scroll. Degrades gracefully (headings just render normally,
     no hidden text) if the CDN didn't load.
  ============================================================ */
  const TextEngine = (function initTextEngine(){
    if (typeof SplitType === 'undefined') return { heroChars:null, revealHero(){} };

    const heroSplit = new SplitType('.hero-name', { types:'chars' });
    if (heroSplit.chars && heroSplit.chars.length){
      gsap.set(heroSplit.chars, { opacity:0, y:'70%', rotateZ:4 });
    }

    gsap.utils.toArray('.section-head h2, .finale h2').forEach(h2 => {
      const split = new SplitType(h2, { types:'words' });
      if (!split.words || !split.words.length) return;
      gsap.set(split.words, { opacity:0, y:'40%' });
      gsap.to(split.words, {
        opacity:1, y:'0%', duration:.9, ease:'power3.out', stagger:0.045,
        scrollTrigger:{ trigger:h2, start:'top 88%' }
      });
    });

    return {
      heroChars: heroSplit.chars,
      revealHero(){
        if (!this.heroChars || !this.heroChars.length) return;
        if (reduceMotion){ gsap.set(this.heroChars, { opacity:1, y:'0%', rotateZ:0 }); return; }
        gsap.to(this.heroChars, { opacity:1, y:'0%', rotateZ:0, duration:1, ease:'power3.out', stagger:0.028 });
      }
    };
  })();

  /* ============================================================
     HERO DATE
  ============================================================ */
  document.getElementById('heroDate').textContent =
    new Date().toLocaleDateString(undefined,{ weekday:'long', year:'numeric', month:'long', day:'numeric' });

  /* ============================================================
     HERO BLOOM SVG — the centerpiece flower opening beside her
     name. Held back until the intro finishes so the two don't
     compete for attention.
  ============================================================ */
  function playHeroBloom(){
    const g = document.getElementById('heroBloomGroup');
    const petalCount = 10;
    const colors = ['var(--rose)','var(--rose-soft)','var(--rose-bright)'];
    const ns = 'http://www.w3.org/2000/svg';
    for (let i=0;i<petalCount;i++){
      const angle = (360/petalCount)*i;
      const long = i % 2 === 0;
      const p = document.createElementNS(ns,'ellipse');
      p.setAttribute('cx', 0); p.setAttribute('cy', long? -95 : -70);
      p.setAttribute('rx', long? 34: 26); p.setAttribute('ry', long? 95: 70);
      p.setAttribute('fill', colors[i % colors.length]);
      p.setAttribute('opacity', '0.85');
      p.setAttribute('transform', `rotate(${angle}) scale(0.05)`);
      p.style.transformOrigin = '0px 0px';
      g.appendChild(p);
      gsap.to(p, { attr:{transform:`rotate(${angle}) scale(1)`}, duration:2, delay: i*0.045, ease:'elastic.out(0.7,0.55)' });
    }
    const core = document.createElementNS(ns,'circle');
    core.setAttribute('r','30'); core.setAttribute('fill','var(--gold)'); core.setAttribute('opacity','0');
    g.appendChild(core);
    gsap.to(core,{opacity:.95, duration:1, delay:1.1});
    if (!reduceMotion) gsap.to(g, { rotation:360, duration:190, repeat:-1, ease:'none', transformOrigin:'0px 0px' });
  }

  /* ============================================================
     SECTION REVEALS + GALLERY PARALLAX
  ============================================================ */
  function initScrollFX(){
    gsap.utils.toArray('.section-head, .note, .player, .dial-row').forEach(el=>{
      gsap.fromTo(el, {opacity:0, y:40}, {
        opacity:1, y:0, duration:.9, ease:'power3.out',
        scrollTrigger:{ trigger: el, start:'top 88%' }
      });
    });

    // The letter is the emotional peak — it gets its own slower pace:
    // drop cap first, then each paragraph in turn, then the signature.
    // Nothing else on the page reveals this deliberately.
    const letterParts = gsap.utils.toArray('.letter-drop, .letter p, .letter-sign');
    if (letterParts.length){
      gsap.fromTo(letterParts, {opacity:0, y:26}, {
        opacity:1, y:0, duration:1.1, ease:'power2.out', stagger:0.35,
        scrollTrigger:{ trigger:'.letter', start:'top 80%' }
      });
    }

    ScrollTrigger.create({
      trigger: '#message', start:'top 60%', end:'bottom 40%',
      onEnter: () => engine.setMood(0.45), onEnterBack: () => engine.setMood(0.45),
      onLeave: () => engine.setMood(1), onLeaveBack: () => engine.setMood(1)
    });
    ScrollTrigger.create({
      trigger: '#finale', start:'top 65%',
      onEnter: () => engine.setMood(1.7), onLeaveBack: () => engine.setMood(1)
    });

    // keep the full index in sync with scroll position, so opening
    // it always shows where you currently are
    function setActiveSection(id){
      gardenIndexLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
    }
    ['#hero','#gallery','#reasons','#message','#playlist','#countdown','#finale'].forEach(id=>{
      ScrollTrigger.create({
        trigger:id, start:'top 55%', end:'bottom 55%',
        onToggle: self => { if (self.isActive) setActiveSection(id); }
      });
    });
    setActiveSection('#hero');


    gsap.utils.toArray('.press-card').forEach((card,i)=>{
      gsap.fromTo(card, {opacity:0, y:50}, {
        opacity:1, y:0, duration:.8, delay:i*0.05, ease:'power3.out',
        scrollTrigger:{ trigger: card, start:'top 92%' }
      });
    });
    ScrollTrigger.matchMedia({
      '(min-width: 701px)': () => {
        document.querySelectorAll('.press-card').forEach(card=>{
          const depth = parseFloat(card.dataset.depth || .5);
          gsap.to(card, {
            y: -120*depth, ease:'none',
            scrollTrigger:{ trigger:'#pressField', start:'top bottom', end:'bottom top', scrub:true }
          });
        });
      }
    });
    document.querySelectorAll('.press-card').forEach(card=>{
      card.addEventListener('mouseenter', ()=> gsap.to(card, {scale:1.04, duration:.5, ease:'power3.out', zIndex:5}));
      card.addEventListener('mouseleave', ()=> gsap.to(card, {scale:1, duration:.5, ease:'power3.out', zIndex:1}));
    });
  }

  /* ============================================================
     AUDIO ENGINE — one soundtrack, not a playlist. Fade in/out,
     playback position + play-state remembered across visits, a
     scrub bar, and best-effort auto-resume: browsers block real
     autoplay without a fresh gesture, so instead of pretending
     otherwise, this arms a one-time listener that resumes on the
     visitor's very first tap/click/key anywhere on the page if
     they left it playing last time — the closest honest version
     of "auto resume" a browser will actually allow.
  ============================================================ */
  const AudioEngine = (function player(){
    const audio    = document.getElementById('audioEl');
    const wrap     = document.getElementById('player');
    const playBtn  = document.getElementById('trackPlayBtn');
    const scrub    = document.getElementById('trackScrub');
    const scrubFill= document.getElementById('trackScrubFill');
    const curEl    = document.getElementById('trackCurrent');
    const durEl    = document.getElementById('trackDuration');
    if (!audio) return null;

    const { storeKey: STORE_KEY, fadeMs: FADE_MS, targetVolume: TARGET_VOL, saveIntervalMs: SAVE_MS } = CONFIG.audio;
    let fadeRAF = null;
    let scrubbing = false;

    const fmt = s => {
      if (!isFinite(s)) return '0:00';
      const m = Math.floor(s/60), sec = Math.floor(s%60);
      return `${m}:${String(sec).padStart(2,'0')}`;
    };
    const saveState = () => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          time: audio.currentTime || 0,
          playing: !audio.paused
        }));
      } catch(e){ /* private mode / storage disabled — fine, just skip */ }
    };
    const loadState = () => {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); }
      catch(e){ return null; }
    };

    function fadeTo(target, ms, onDone){
      cancelAnimationFrame(fadeRAF);
      const start = audio.volume, delta = target - start, t0 = performance.now();
      (function step(now){
        const p = Math.min(1, (now - t0) / ms);
        audio.volume = start + delta * (p*(2-p)); // ease-out
        if (p < 1){ fadeRAF = requestAnimationFrame(step); }
        else if (onDone){ onDone(); }
      })(t0);
    }

    function play(){
      audio.volume = 0;
      return audio.play().then(()=>{
        wrap.classList.add('playing');
        fadeTo(TARGET_VOL, FADE_MS);
      }).catch(()=>{
        // autoplay/decoding blocked (e.g. no file dropped in yet) —
        // fail quietly rather than showing a broken UI state
        wrap.classList.remove('playing');
      });
    }
    function pause(){
      fadeTo(0, FADE_MS, () => { audio.pause(); });
      wrap.classList.remove('playing');
    }

    playBtn.addEventListener('click', ()=>{
      if (audio.paused) play(); else pause();
    });

    // best-effort auto-resume: arm a one-time listener on the very
    // first interaction anywhere on the page, not just on the player
    // itself, so returning visitors who left it playing get it back
    // as soon as the browser will legally allow
    const saved = loadState();
    if (saved && saved.playing){
      const resumeOnce = () => { play(); cleanup(); };
      const cleanup = () => ['pointerdown','keydown','touchstart'].forEach(ev => document.removeEventListener(ev, resumeOnce));
      ['pointerdown','keydown','touchstart'].forEach(ev => document.addEventListener(ev, resumeOnce, { once:false }));
    }

    audio.addEventListener('loadedmetadata', ()=>{
      durEl.textContent = fmt(audio.duration);
      if (saved && saved.time > 0 && saved.time < audio.duration - 1){
        audio.currentTime = saved.time;
      }
    });
    audio.addEventListener('timeupdate', ()=>{
      if (scrubbing) return;
      curEl.textContent = fmt(audio.currentTime);
      const pct = audio.duration ? (audio.currentTime/audio.duration)*100 : 0;
      scrubFill.style.width = pct + '%';
      scrub.setAttribute('aria-valuenow', Math.round(pct));
    });
    audio.addEventListener('ended', ()=>{ wrap.classList.remove('playing'); saveState(); });
    window.addEventListener('beforeunload', saveState);
    document.addEventListener('visibilitychange', ()=> { if (document.hidden) saveState(); });
    setInterval(()=>{ if (!audio.paused) saveState(); }, SAVE_MS);

    function seekFromEvent(e){
      const r = scrub.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = clamp((clientX - r.left) / r.width, 0, 1);
      if (audio.duration){ audio.currentTime = pct * audio.duration; }
      scrubFill.style.width = (pct*100) + '%';
    }
    scrub.addEventListener('pointerdown', e=>{ scrubbing = true; seekFromEvent(e); });
    window.addEventListener('pointermove', e=>{ if (scrubbing) seekFromEvent(e); });
    window.addEventListener('pointerup', ()=>{ scrubbing = false; });
    scrub.addEventListener('keydown', e=>{
      if (!audio.duration) return;
      if (e.key === 'ArrowRight'){ audio.currentTime = Math.min(audio.duration, audio.currentTime+5); }
      if (e.key === 'ArrowLeft'){  audio.currentTime = Math.max(0, audio.currentTime-5); }
    });

    return { play, pause, setVolume:(v)=>fadeTo(clamp(v,0,1), FADE_MS) };
  })();

  /* ============================================================
     COUNTDOWN
  ============================================================ */
  (function countdown(){
    const NEXT_BIRTHDAY = CONFIG.countdown.nextBirthday;
    const dials = document.querySelectorAll('.dial');
    dials.forEach(d=>{
      const r = parseFloat(d.querySelector('.prog').getAttribute('r'));
      const circ = 2*Math.PI*r;
      d.querySelector('.prog').style.strokeDasharray = circ;
      d.dataset.circ = circ;
    });
    function tick(){
      const diff = Math.max(0, NEXT_BIRTHDAY - new Date());
      const d = Math.floor(diff/86400000);
      const h = Math.floor(diff/3600000)%24;
      const m = Math.floor(diff/60000)%60;
      const s = Math.floor(diff/1000)%60;
      const vals = {days:[d,365], hours:[h,24], minutes:[m,60], seconds:[s,60]};
      dials.forEach(dial=>{
        const unit = dial.dataset.unit;
        const [v,max] = vals[unit];
        dial.querySelector('.val').textContent = String(v).padStart(2,'0');
        const prog = dial.querySelector('.prog');
        const circ = parseFloat(dial.dataset.circ);
        prog.style.strokeDashoffset = circ * (1 - Math.min(1, v/max));
      });
    }
    tick(); setInterval(tick, 1000);
  })();

  /* ============================================================
     FINALE CONFETTI — also seeds a burst into the petal engine
  ============================================================ */
  document.getElementById('confettiBtn').addEventListener('click', (e)=>{
    const colors = ['#e88fa3','#f0b9c4','#d9ab72','#ff9fc0'];
    confetti({ particleCount: 120, spread: 100, startVelocity: 36, gravity:.7, scalar:1.1, colors, origin:{y:.7} });
    confetti({ particleCount: 50, spread: 140, startVelocity: 20, gravity:.5, scalar:.8, colors, origin:{y:.6}, angle:60 });
    confetti({ particleCount: 50, spread: 140, startVelocity: 20, gravity:.5, scalar:.8, colors, origin:{y:.6}, angle:120 });
    const r = e.currentTarget.getBoundingClientRect();
    engine.burst(r.left+r.width/2, r.top, 22, {spread:Math.PI*1.4, minSpeed:2, maxSpeed:6, gravity:0.1});
  });

  /* ============================================================
     INTRO — cinematic reveal, not the gift-box unwrap. Three motion
     layers work together rather than one animation doing everything:
       1. soft glowing motes gather in from the edges toward a point
       2. real flower-emoji sprites (from the same set used across
          the site) drift slowly across the frame at their own depth
       3. a full flower unfolds from the light, flashes, and dissolves
          — with a touch of blur — straight into the page's own
          petal field, while the hero content crossfades in underneath
          so the handoff has no hard cut.
  ============================================================ */
  function runIntro(){
    const overlay = document.getElementById('intro');
    const canvas  = document.getElementById('introCanvas');
    const caption = document.getElementById('introCaption');
    const skipBtn = document.getElementById('introSkip');
    const heroContent = document.querySelector('.hero-content');
    document.body.classList.add('intro-active');

    if (reduceMotion){
      overlay.remove();
      document.body.classList.remove('intro-active');
      if (heroContent) heroContent.classList.add('reveal');
      TextEngine.revealHero();
      lenis.start();
      playHeroBloom();
      initScrollFX();
      return;
    }

    const ctx = canvas.getContext('2d');
    let W,H,DPR;
    function resize(){
      DPR = Math.min(window.devicePixelRatio||1, 2);
      W = canvas.width  = innerWidth*DPR;
      H = canvas.height = innerHeight*DPR;
      canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px';
      ctx.setTransform(DPR,0,0,DPR,0,0);
    }
    resize(); window.addEventListener('resize', resize);

    const cx = () => innerWidth/2;
    const cy = () => innerHeight/2;

    // layer 1 — soft points of light that gather in toward the center
    const N = 26;
    const motes = Array.from({length:N}, () => ({
      angle: Math.random()*Math.PI*2,
      dist:  rand(0.5, 1),
      size:  rand(1.4, 3.6),
      twPhase: Math.random()*Math.PI*2,
      twSpeed: rand(0.0016, 0.0038),
    }));

    // layer 2 — a handful of real flower-emoji sprites (same sprite
    // cache the ambient petal engine uses) drifting slowly across the
    // frame at their own pace and depth, independent of the gathering
    // light — the thing that was missing before was flowers themselves,
    // not just glow, floating through the opening shot.
    const driftFlowers = Array.from({length:7}, () => ({
      sprite: spriteCache.get(weightedEmoji[(Math.random()*weightedEmoji.length)|0]),
      xStart: rand(-0.2, 1.0),
      y: rand(0.14, 0.86),
      speed: rand(0.055, 0.11),   // fraction of screen width per second
      size: rand(28, 52),
      bob: rand(10, 20),
      bobSpeed: rand(0.0005, 0.0009),
      bobPhase: Math.random()*Math.PI*2,
      spin: rand(-0.25, 0.25),
      spinSpeed: rand(-0.0004, 0.0004),
      born: null,
    }));

    // scene state, driven entirely by GSAP tweens below
    const scene = { glow:0, gather:0, bloom:0, spin:0, flash:0, drift:0, opacity:1 };

    function drawGlow(){
      const R = 240 * (0.35 + scene.glow*0.75) * (1 + scene.flash*0.7);
      if (R <= 0) return;
      const g = ctx.createRadialGradient(cx(),cy(),0, cx(),cy(),R);
      g.addColorStop(0,    `rgba(255,222,232,${0.55*scene.glow + scene.flash*0.45})`);
      g.addColorStop(0.55, `rgba(255,159,192,${0.26*scene.glow})`);
      g.addColorStop(1,    'rgba(255,159,192,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx(),cy(),R,0,Math.PI*2); ctx.fill();
    }
    function drawMotes(now){
      const R = Math.min(innerWidth, innerHeight) * 0.6;
      motes.forEach(m=>{
        const d = m.dist * R * (1 - scene.gather);
        const x = cx() + Math.cos(m.angle)*d;
        const y = cy() + Math.sin(m.angle)*d;
        const tw = 0.5 + Math.sin(now*m.twSpeed + m.twPhase)*0.5;
        ctx.globalAlpha = (0.22 + tw*0.55) * (1 - scene.gather*0.4);
        ctx.fillStyle = '#ffe3ee';
        ctx.beginPath(); ctx.arc(x,y,m.size,0,Math.PI*2); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    function drawDriftFlowers(now){
      if (scene.drift <= 0) return;
      driftFlowers.forEach(f=>{
        if (f.born === null) f.born = now;
        const t = (now - f.born) / 1000;
        const x = ((f.xStart + f.speed*t*0.12) % 1.3 - 0.15) * innerWidth;
        const y = f.y*innerHeight + Math.sin(now*f.bobSpeed + f.bobPhase)*f.bob;
        const rot = f.spin + now*f.spinSpeed;
        ctx.save();
        ctx.globalAlpha = scene.drift * 0.8;
        ctx.translate(x,y); ctx.rotate(rot);
        ctx.drawImage(f.sprite, -f.size/2, -f.size/2, f.size, f.size);
        ctx.restore();
      });
    }
    function drawFlower(){
      if (scene.bloom <= 0) return;
      const petals = 8;
      const colors = ['#e88fa3','#f0b9c4','#ff9fc0'];
      ctx.save();
      ctx.translate(cx(), cy());
      ctx.rotate(scene.spin);
      const len = 96 * scene.bloom, wid = 34 * scene.bloom;
      for (let i=0;i<petals;i++){
        ctx.save();
        ctx.rotate((Math.PI*2/petals)*i);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.ellipse(0, -len*0.55, wid*0.5, len*0.55, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#d9ab72';
      ctx.beginPath(); ctx.arc(0,0, 15*scene.bloom, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    function drawScene(now){
      ctx.clearRect(0,0,innerWidth,innerHeight);
      if (scene.opacity <= 0) return;
      ctx.save();
      ctx.globalAlpha = scene.opacity;
      drawGlow();
      drawDriftFlowers(now);
      drawMotes(now);
      drawFlower();
      ctx.restore();
    }

    let raf;
    (function loop(now){ drawScene(now||0); raf = requestAnimationFrame(loop); })();

    function finish(){
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      overlay.remove();
      document.body.classList.remove('intro-active');
      lenis.start();
      initScrollFX();
    }

    overlay.style.filter = 'blur(0px)';
    const tl = gsap.timeline({ defaults:{ ease:'power2.out' }, onComplete: finish });

    // phase 1 — black frame breathes open, flower emojis drift in first
    tl.to(scene, { drift:1, duration:.9, ease:'sine.out' })
      .to(scene, { glow:1, duration:1.0, ease:'sine.inOut' }, '-=.55')
      .to(scene, { gather:1, duration:1.15, ease:'power3.inOut' }, '-=.55')
      .to(caption, { opacity:1, duration:.6 }, '-=.7')
      .to(scene, { drift:0, duration:.8, ease:'sine.in' }, '-=.9')
      // phase 2 — light blooms into a full flower
      .to(scene, { bloom:1, spin: 0.35, duration:1.35, ease:'elastic.out(0.7,0.6)' }, '-=.25')
      .to(caption, { opacity:0, duration:.45 }, '-=.6')
      .to(scene, { flash:1, duration:.32, ease:'power2.out' }, '+=.05')
      .call(() => {
        engine.burst(cx(), cy(), 30, { spread:Math.PI*2, minSpeed:4, maxSpeed:10, gravity:.12, maxLife:4200 });
        // staggered flower-wall spawns across the width, like the
        // bloom's light settling into the page's own petal field
        const steps = 14;
        for (let i=0;i<steps;i++){
          gsap.delayedCall(i*0.05, () => {
            engine.burst(rand(0,innerWidth), innerHeight+20, 3, { spread:Math.PI*0.5, minSpeed:4, maxSpeed:8, gravity:.12, maxLife:4200 });
          });
        }
      })
      .to(scene, { flash:0, duration:.6 }, '+=.05')
      // phase 3 — dissolve (opacity + a touch of blur for depth) while
      // the hero crossfades in underneath, so the cut is never hard
      .call(() => { if (heroContent) heroContent.classList.add('reveal'); TextEngine.revealHero(); playHeroBloom(); }, null, '+=.9')
      .to(scene, { opacity:0, duration:.9, ease:'sine.in' }, '<')
      .to(overlay, { opacity:0, duration:.9, pointerEvents:'none', filter:'blur(10px)', ease:'sine.in' }, '<');

    skipBtn.addEventListener('click', () => {
      tl.progress(1);
    });

    // don't let wheel/touch scroll leak out during intro
    const blockScroll = (e) => e.preventDefault();
    overlay.addEventListener('wheel', blockScroll, {passive:false});
    overlay.addEventListener('touchmove', blockScroll, {passive:false});
  }

  runIntro();

  /* ============================================================
     NB NAMESPACE — every subsystem above already exists as its
     own reusable unit (a class, a closure, a plain object); this
     just gathers them under one discoverable name instead of
     leaving them as anonymous IIFEs, and gives each the name the
     brief asks for. Nothing here changes behaviour — it's the
     "reusable internal systems" requirement made explicit rather
     than implicit.
       ConfigEngine      → CONFIG
       ParticleEngine    → engine (petal/flower physics + rendering)
       FlowerEngine      → the same engine — sprite set, weighting,
                            per-particle behaviour live inside it
       AudioEngine       → AudioEngine
       TextEngine        → TextEngine (SplitType reveals)
       ResponsiveEngine  → tier selection + densityScale, both on `engine`
       PerformanceEngine → the live frame monitor inside engine.tick()
     TransitionEngine, CursorEngine and MicroInteractionEngine are
     intentionally left as the scoped closures above — they hold no
     state anything else needs, so promoting them here would just
     be indirection without benefit.
  ============================================================ */
  window.NB = {
    ConfigEngine: CONFIG,
    ParticleEngine: engine,
    FlowerEngine: engine,
    AudioEngine: AudioEngine,
    TextEngine: TextEngine,
  };
})();
