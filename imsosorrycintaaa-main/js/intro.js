/* ============================================================
   INTRO — a premium PIN gate, then a one-shot cinematic reveal:

     PIN card → correct code → unlock animation → screen darkens
     → music starts → a full screen of large flowers, spawned once,
     falls slowly with natural easing and wind drift, while the
     homepage progressively shows through underneath → a soft glow
     → "For Someone Special…" fades in → the last flowers drift off
     → done.

   No animation library is required for any of this — the gate, the
   darken, the caption and the final handoff are all plain CSS
   transitions/classes, and the flowers are a small self-contained
   canvas particle loop. That's deliberate: this file is the one
   place a visitor can get physically stuck (scroll is locked for
   the duration), so it depends on as little as possible.

   Self-invokes at the bottom of this file. Loads after config.js,
   utils.js, petals-engine.js (used opportunistically only, for the
   emoji list — not required), hero.js (playHeroBloom),
   scroll-reveal.js (initScrollFX), music-player.js
   (window.__startBackgroundMusic) and app.js (lenis) — i.e. last.

   RELIABILITY CONTRACT — unchanged from the intro this replaces:
     - every optional dependency is checked before use and wrapped in
       try/catch
     - a hard wall-clock fail-safe finishes the reveal if the normal
       sequence never completes for any reason
     - `finish` is idempotent and safe to call from more than one place
     - however badly something else on the page misbehaves, the
       visitor still reaches a scrollable homepage within bounded time
       once they've entered the correct PIN
============================================================ */
'use strict';

function runIntro(){
  // Tell the page-level watchdog (inline <script> right after the
  // intro markup in index.html) that this file made it this far.
  window.__introStarted = true;

  const overlay     = document.getElementById('intro');
  const heroContent = document.querySelector('.hero-content');
  if (!overlay) return; // no overlay in the markup — nothing to gate

  let finished       = false;
  let failSafeTimer  = null;
  let heroBloomed    = false; // playHeroBloom() isn't safe to call twice
  let stopFlowerLoop = null;  // set once the flower loop exists

  // The one path back to a usable page. Safe to call more than once
  // (natural completion, the fail-safe timeout, and a caught error
  // can all reach here) and safe even if setup never got far.
  function finish(){
    if (finished) return;
    finished = true;
    if (failSafeTimer) clearTimeout(failSafeTimer);
    if (typeof stopFlowerLoop === 'function'){
      try { stopFlowerLoop(); } catch (e){ /* ignore */ }
    }
    try { overlay.remove(); } catch (e){ /* already gone */ }
    document.body.classList.remove('intro-active');
    if (heroContent) heroContent.classList.add('reveal');
    try {
      if (typeof lenis !== 'undefined' && lenis && typeof lenis.start === 'function') lenis.start();
    } catch (e){ console.warn('[intro] lenis.start() failed — scroll may already be native.', e); }
    playHeroBloomOnce();
    try {
      if (typeof initScrollFX === 'function') initScrollFX();
    } catch (e){ console.warn('[intro] initScrollFX failed — scroll-linked reveals will be skipped, page stays fully usable.', e); }
  }

  function playHeroBloomOnce(){
    if (heroBloomed) return;
    heroBloomed = true;
    try {
      if (typeof playHeroBloom === 'function') playHeroBloom();
    } catch (e){ console.warn('[intro] playHeroBloom failed — non-fatal.', e); }
  }

  document.body.classList.add('intro-active');

  const pinScreen  = document.getElementById('pinScreen');
  const pinCard    = pinScreen ? pinScreen.querySelector('.pin-card') : null;
  const pinDots    = pinScreen ? Array.from(pinScreen.querySelectorAll('.pin-dot')) : [];
  const pinError   = document.getElementById('pinError');
  const pinPad     = document.getElementById('pinPad');
  const introGlow  = document.getElementById('introGlow');
  const revealText = document.getElementById('introRevealText');
  const canvas     = document.getElementById('introCanvas');
  const motesHost  = document.getElementById('introMotes');

  spawnMotes(motesHost); // purely decorative, runs regardless of PIN state

  // No PIN gate in the markup at all → nothing to gate on.
  if (!pinScreen){ finish(); return; }

  const FR = (typeof CONFIG !== 'undefined' && CONFIG.flowerReveal) ? CONFIG.flowerReveal : {};
  const PIN_CODE      = (typeof CONFIG !== 'undefined' && CONFIG.pin && CONFIG.pin.code) ? String(CONFIG.pin.code) : '1234';
  const HOME_DELAY_MS = FR.homeRevealDelayMs ?? 500;
  const HOME_MS       = FR.homeRevealMs      ?? 4200;
  const CAPTION_MS    = FR.captionDelayMs    ?? 2600;
  const MAX_MS        = FR.maxDurationMs     ?? 8200;
  const REVEAL_COPY   = FR.text || 'For Someone Special\u2026';
  if (revealText) revealText.textContent = REVEAL_COPY;
  overlay.style.setProperty('--home-reveal-ms', HOME_MS + 'ms');

  /* ============================================================
     DECORATIVE MOTES — tiny floating particles behind the glass
     card, purely CSS-animated once placed.
  ============================================================ */
  function spawnMotes(host){
    if (!host || reduceMotion) return;
    try {
      const COUNT = matchMedia('(max-width:700px)').matches ? 10 : 16;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < COUNT; i++){
        const m = document.createElement('span');
        m.className = 'pin-mote';
        const size = rand(2, 5);
        m.style.width  = size + 'px';
        m.style.height = size + 'px';
        m.style.left   = rand(2, 98) + '%';
        m.style.top    = rand(4, 96) + '%';
        m.style.setProperty('--mx', rand(-24,24).toFixed(1) + 'px');
        m.style.animationDuration = rand(6, 12).toFixed(1) + 's';
        m.style.animationDelay    = rand(0, 6).toFixed(1) + 's';
        frag.appendChild(m);
      }
      host.appendChild(frag);
    } catch (e){ console.warn('[intro] decorative motes failed to spawn — non-fatal.', e); }
  }

  /* ============================================================
     PIN ENTRY
  ============================================================ */
  let digits = '';
  let locked = false; // true once the correct code has been entered

  function renderDots(){
    pinDots.forEach((d,i) => {
      d.classList.toggle('filled', i < digits.length);
      d.classList.toggle('active', !locked && i === digits.length);
    });
  }
  renderDots();

  function showError(){
    if (pinError) pinError.classList.add('show');
    const shakeTarget = pinCard || pinScreen;
    shakeTarget.classList.remove('shake');
    void shakeTarget.offsetWidth; // restart the shake animation reliably
    shakeTarget.classList.add('shake');
    setTimeout(() => {
      digits = '';
      renderDots();
      if (pinError) pinError.classList.remove('show');
      shakeTarget.classList.remove('shake');
    }, 650);
  }
  function checkPin(){
    if (digits === PIN_CODE){
      locked = true;
      renderDots();
      try { onCorrectPin(); }
      catch (e){ console.warn('[intro] reveal sequence failed to start — falling back to an instant reveal.', e); finish(); }
    } else {
      showError();
    }
  }
  function pushDigit(d){
    if (locked || digits.length >= 4) return;
    digits += d;
    renderDots();
    if (digits.length === 4) setTimeout(checkPin, 140);
  }
  function backspace(){
    if (locked) return;
    digits = digits.slice(0, -1);
    renderDots();
  }

  if (pinPad){
    // A single delegated listener covers every key, mouse or touch —
    // browsers already synthesize `click` from a tap, so no separate
    // touchend handler is needed here.
    pinPad.addEventListener('click', (e) => {
      if (locked) return;
      const key = e.target.closest('.pin-key');
      if (!key) return;
      if (key.id === 'pinBackspace'){ backspace(); return; }
      const d = key.getAttribute('data-digit');
      if (d != null) pushDigit(d);
    });
  }
  function onKeydown(e){
    if (locked) return;
    if (/^[0-9]$/.test(e.key)) pushDigit(e.key);
    else if (e.key === 'Backspace') backspace();
  }
  document.addEventListener('keydown', onKeydown);

  /* ============================================================
     ON CORRECT PIN — unlock → darken → music → flowers
  ============================================================ */
  function onCorrectPin(){
    document.removeEventListener('keydown', onKeydown);

    // From this moment on, the visitor must reach the homepage no
    // matter what goes wrong below — a generous margin above the
    // sequence's own planned runtime.
    failSafeTimer = setTimeout(() => {
      console.warn('[intro] fail-safe timeout reached — finishing without waiting further.');
      finish();
    }, MAX_MS + 4000);

    // The PIN entry itself was the qualifying user gesture — use it
    // right now, synchronously in this same handler, so every
    // browser's autoplay policy (Safari included) still counts it.
    try {
      if (typeof window.__startBackgroundMusic === 'function') window.__startBackgroundMusic();
    } catch (e){ console.warn('[intro] could not start music — non-fatal.', e); }

    pinScreen.classList.add('unlocked'); // dots pulse gold, the card eases away
    setTimeout(() => {
      overlay.classList.add('deepen'); // the screen softly darkens
      setTimeout(beginFlowers, 260);
    }, 420);
  }

  /* ============================================================
     FLOWERS — a single wave of large flowers, spawned all at once
     so they already cover almost the entire screen, then falling
     slowly with eased gravity, gentle wind drift and rotation.
     Nothing is respawned once it drifts off — this plays exactly
     once. Three depth bands (back/mid/front) are painted back to
     front for a real sense of depth.
  ============================================================ */
  function beginFlowers(){
    try {
      // The homepage backdrop reveal and the caption are independent
      // of the flowers' own physics — scheduling them on a fixed
      // clock keeps the sequence's total runtime guaranteed even if
      // the canvas or its particles misbehave.
      setTimeout(() => { overlay.classList.add('opening'); }, HOME_DELAY_MS);
      setTimeout(() => { if (introGlow) introGlow.classList.add('show'); }, Math.max(0, CAPTION_MS - 700));
      setTimeout(() => { if (revealText) revealText.classList.add('show'); }, CAPTION_MS);
      setTimeout(() => { finish(); }, MAX_MS);

      if (reduceMotion || !canvas) return; // caption + timed finish above still runs

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let W, H;
      function resize(){
        const DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.width  = innerWidth  * DPR;
        H = canvas.height = innerHeight * DPR;
        canvas.style.width  = innerWidth  + 'px';
        canvas.style.height = innerHeight + 'px';
        ctx.setTransform(DPR,0,0,DPR,0,0);
      }
      resize();
      // Coalesce mobile browsers' repeated resize events (address
      // bar show/hide) into one resize per frame.
      let resizePending = false;
      function onResize(){
        if (resizePending) return;
        resizePending = true;
        requestAnimationFrame(() => { resizePending = false; try { resize(); } catch (e){} });
      }
      window.addEventListener('resize', onResize);

      // A small, self-contained, high-resolution sprite cache just
      // for these large hero flowers — independent of the ambient
      // background's lower-res cache, so they stay crisp at 200px+.
      const SPECIES = (typeof CONFIG !== 'undefined' && CONFIG.petals && CONFIG.petals.species && CONFIG.petals.species.length)
        ? CONFIG.petals.species.map(s => s.ch)
        : ['🌸','🌷','🌹','🌺','💐','🪷'];
      const EMOJI_FONT_FALLBACK = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      const bigSprites = new Map();
      function getBigSprite(ch){
        if (bigSprites.has(ch)) return bigSprites.get(ch);
        const s = 320;
        const c = document.createElement('canvas');
        c.width = c.height = s;
        const cx = c.getContext('2d');
        cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.font = `${s*0.72}px ${(typeof EMOJI_FONT === 'string') ? EMOJI_FONT : EMOJI_FONT_FALLBACK}`;
        cx.shadowColor = 'rgba(255,190,210,.4)';
        cx.shadowBlur = s*0.05;
        cx.fillText(ch, s/2, s/2 + s*0.02);
        cx.shadowBlur = 0;
        cx.fillText(ch, s/2, s/2 + s*0.02);
        bigSprites.set(ch, c);
        return c;
      }
      function pickSprite(){ return getBigSprite(SPECIES[(Math.random()*SPECIES.length)|0]); }

      // Device budget — mirrors CONFIG.tiers' own naming (via
      // petals-engine.js's `tierName`, used opportunistically) rather
      // than inventing a second detection scheme.
      const counts = FR.counts || { minimal:12, low:22, medium:36, high:52 };
      const tier = (typeof tierName === 'string' && counts[tierName] != null)
        ? tierName
        : (matchMedia('(max-width:700px)').matches ? 'low' : 'medium');
      const BUDGET = Math.max(8, counts[tier] ?? 36);
      // The 90–230px range in config was tuned looking at a desktop
      // viewport. On a ~360–430px-wide phone a 230px flower is well
      // over half the screen width — it stops reading as "flowers
      // falling over the page" and starts reading as oversized shapes
      // colliding with the name underneath. Scale the whole range down
      // by how narrow the viewport actually is, floor included so it
      // never gets so small the effect disappears.
      const viewportScale = clamp(innerWidth / 900, 0.42, 1);
      const SIZE_MIN = (FR.sizeMinPx ?? 90) * viewportScale;
      const SIZE_MAX = (FR.sizeMaxPx ?? 230) * viewportScale;

      // Three depth bands, painted back → front. Back flowers are
      // smaller, slower and softly blurred; front ones are the
      // large, crisp, "cover the screen" hero flowers.
      const span = SIZE_MAX - SIZE_MIN;
      const BANDS = [
        { n: Math.round(BUDGET*0.30), size:[SIZE_MIN, SIZE_MIN+span*0.35], speed:[16,28], blurPx:2.2, op:[0.55,0.75] },
        { n: Math.round(BUDGET*0.38), size:[SIZE_MIN+span*0.3, SIZE_MIN+span*0.68], speed:[26,42], blurPx:0, op:[0.78,0.94] },
        { n: Math.round(BUDGET*0.32), size:[SIZE_MIN+span*0.62, SIZE_MAX], speed:[36,58], blurPx:0, op:[0.92,1] },
      ];

      const particles = [];
      function spawn(band){
        particles.push({
          sprite: pickSprite(),
          x: rand(-40, innerWidth+40),
          // already distributed across nearly the whole viewport, so
          // the very first frame reads as "flowers cover the screen"
          y: rand(-innerHeight*0.12, innerHeight*0.9),
          vy: 0, // eased in smoothly below rather than starting at full speed
          targetVy: rand(band.speed[0], band.speed[1]), // px/sec
          vx: rand(-6,6), // px/sec, wind adds to this
          size: rand(band.size[0], band.size[1]),
          rot: Math.random()*Math.PI*2,
          vrot: rand(-0.22,0.22), // rad/sec
          opacity: 0,
          targetOpacity: rand(band.op[0], band.op[1]),
          appearAt: rand(0, 420), // ms — staggers the initial fade-in
          phase: Math.random()*Math.PI*2,
          freq: rand(0.35, 0.9), // Hz-ish, for the wind sway
          blurPx: band.blurPx,
          done: false,
        });
      }
      BANDS.forEach(band => { for (let i=0;i<band.n;i++) spawn(band); });

      let lastT = performance.now();
      const t0  = lastT;
      let raf = null;
      let loopAlive = true;

      function stepParticle(p, dtSec, elapsedMs){
        if (elapsedMs < p.appearAt) return; // not "in" yet
        const age = elapsedMs - p.appearAt;
        if (p.opacity < p.targetOpacity) p.opacity = Math.min(p.targetOpacity, p.opacity + dtSec*2.4);

        // ease speed up toward its target — a graceful, weighted
        // release rather than an instant constant fall
        p.vy += (p.targetVy - p.vy) * Math.min(1, dtSec*0.9);

        const wind = Math.sin((age/1000)*p.freq + p.phase) * 14;
        p.vx += (wind - p.vx) * Math.min(1, dtSec*0.6);

        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.rot += p.vrot * dtSec;

        if (p.y - p.size*0.6 > innerHeight) p.done = true; // drifted off — never recycled
      }
      function draw(){
        ctx.clearRect(0,0,innerWidth,innerHeight);
        for (const p of particles){
          if (p.done || p.opacity <= 0.003) continue;
          ctx.save();
          ctx.globalAlpha = p.opacity;
          if (p.blurPx) ctx.filter = `blur(${p.blurPx}px)`;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.drawImage(p.sprite, -p.size/2, -p.size/2, p.size, p.size);
          ctx.restore();
        }
      }

      (function loop(now){
        if (!loopAlive) return;
        const dtMs  = Math.min(48, now - lastT || 16.7);
        const dtSec = dtMs/1000;
        lastT = now;
        const elapsedMs = now - t0;
        try {
          for (const p of particles) stepParticle(p, dtSec, elapsedMs);
          draw();
        } catch (e){
          // One bad frame must never kill the rest of the sequence.
          console.warn('[intro] a flower frame failed to draw — continuing.', e);
        }
        raf = requestAnimationFrame(loop);
      })(lastT);

      stopFlowerLoop = function(){
        loopAlive = false;
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
      };

    } catch (err){
      console.warn('[intro] flower reveal failed to start — the timed handoff above still runs.', err);
    }
  }
}

try {
  runIntro();
} catch (err){
  // Belt and braces: if even calling runIntro() somehow throws outside
  // its own try/catch, make sure the visitor still isn't stuck behind
  // the overlay with scroll locked.
  console.warn('[intro] unrecoverable error — force-unlocking the page.', err);
  if (typeof window.__rescueIntroPage === 'function'){
    window.__rescueIntroPage();
  } else {
    document.body.classList.remove('intro-active');
    const overlay = document.getElementById('intro');
    if (overlay) overlay.remove();
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) heroContent.classList.add('reveal');
    try { if (typeof lenis !== 'undefined' && lenis) lenis.start(); } catch (e){}
  }
}
