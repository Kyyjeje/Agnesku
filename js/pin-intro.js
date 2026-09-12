/* ============================================================
   PIN INTRO — replaces the old canvas/GSAP intro engine entirely.
   Deliberately simple: plain DOM + CSS transitions/animations, no
   canvas, no GSAP, no timeline library, and no on-screen custom
   keypad. That's the actual fix for "unstable / won't open on
   mobile": the old engine's biggest risk surface was its own
   complexity (a hand-rolled canvas draw loop, a ~15-tween GSAP
   timeline, a third-party smooth-scroll dependency all needing to
   hand off to each other cleanly, plus a custom on-screen number
   pad fighting the OS keyboard). This file has far fewer moving
   parts, so there's far less that can jam — one real <input>
   drives the OS's own numeric keyboard, which every phone already
   knows how to show reliably.

   The digit boxes themselves follow the same interaction language
   as "Model 5"'s gate: a transparent input sits over a row of boxes
   built dynamically from the PIN length, each lighting up with a
   dot as a digit lands, with shake/success states on the card.

   Flow:
     1. #pinGate is in the markup already, visible on first paint —
        no JS needed for the PIN screen to "appear immediately".
     2. Correct PIN → success pulse on the card, start music
        synchronously (same trusted gesture), darken the screen,
        shower CSS-only flower spans, show a short line of text.
     3. Homepage crossfades in behind the flowers (opacity + a soft
        blur-out, not a hard cut); scroll unlocks.
     4. Flowers fade out; veil is removed; page is fully interactive.

   RELIABILITY CONTRACT, same spirit as the file it replaces:
     - every optional dependency (lenis, playHeroBloom, initScrollFX)
       is checked before use and wrapped in try/catch
     - a hard wall-clock timeout finishes the reveal even if a
       transition/animation event never fires
     - finish() is idempotent and safe to call more than once
     - a tiny dependency-free watchdog in index.html (inline,
       runs before this file even downloads) is the backstop for the
       case this file never runs at all
============================================================ */
'use strict';

(function pinIntro(){
  // Tell the inline watchdog in index.html this file made it this
  // far — mirrors the old intro's __introStarted handshake.
  window.__pinIntroStarted = true;

  const gate        = document.getElementById('pinGate');
  const card        = document.getElementById('pinCard');
  const form        = document.getElementById('pinForm');
  const digitsWrap  = document.getElementById('pinDigits');
  const input       = document.getElementById('pinInput');
  const errorEl     = document.getElementById('pinError');
  const veil        = document.getElementById('bloomVeil');
  const veilDark    = document.getElementById('bloomVeilDark');
  const flowersEl   = document.getElementById('bloomFlowers');
  const textEl      = document.getElementById('bloomText');
  const heroContent = document.querySelector('.hero-content');

  let finished = false;
  let failSafeTimer = null;

  // The one and only path back to a fully usable page. Safe to call
  // more than once (natural completion, the fail-safe timeout, and a
  // caught error can all reach here).
  function finish(){
    if (finished) return;
    finished = true;
    if (failSafeTimer) clearTimeout(failSafeTimer);
    document.documentElement.classList.remove('pin-locked');
    document.body.classList.remove('pin-locked');
    try { if (gate && gate.parentNode) gate.remove(); } catch (e){ /* already gone */ }
    try { if (veil && veil.parentNode) veil.remove(); } catch (e){ /* already gone */ }
    if (heroContent) heroContent.classList.add('reveal');
    try {
      if (typeof playHeroBloom === 'function') playHeroBloom();
    } catch (e){ console.warn('[pin-intro] playHeroBloom failed — non-fatal.', e); }
    try {
      if (typeof initScrollFX === 'function') initScrollFX();
    } catch (e){ console.warn('[pin-intro] initScrollFX failed — scroll-linked reveals will be skipped, page stays fully usable.', e); }
    try {
      if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start();
    } catch (e){ console.warn('[pin-intro] lenis.start() failed — scroll may already be native.', e); }
  }

  // No gate in the markup at all → nothing to gate, just make sure
  // the page is usable and stop here.
  if (!gate || !card || !form || !digitsWrap || !input){
    finish();
    return;
  }

  const PIN_VALUE  = String((typeof CONFIG !== 'undefined' && CONFIG.pin && CONFIG.pin.code) || '0000');
  const PIN_LENGTH = Math.min(8, Math.max(4, PIN_VALUE.length));
  const reduced    = (typeof reduceMotion !== 'undefined') ? reduceMotion : window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  input.setAttribute('maxlength', String(PIN_LENGTH));

  // Build digit boxes dynamically from PIN_LENGTH, same visual
  // contract as Model 5's gate: one box per digit, each with a dot
  // that scales in once that position is filled.
  const boxes = [];
  for (let i = 0; i < PIN_LENGTH; i++){
    const box = document.createElement('span');
    box.className = 'pin-digit';
    const dot = document.createElement('span');
    dot.className = 'pin-digit__dot';
    box.appendChild(dot);
    digitsWrap.appendChild(box);
    boxes.push(box);
  }

  function render(){
    const val = input.value;
    boxes.forEach((box, idx) => {
      box.classList.toggle('is-filled', idx < val.length);
      box.classList.toggle('is-active', idx === val.length);
    });
  }

  function clearError(){
    card.classList.remove('is-error');
    if (errorEl) errorEl.classList.remove('is-visible');
  }

  function shakeError(){
    clearError();
    input.value = '';
    render();
    void card.offsetWidth; // restart the shake animation on repeat wrong entries
    card.classList.add('is-error');
    if (errorEl) errorEl.classList.add('is-visible');

    const onEnd = () => card.classList.remove('is-error');
    card.addEventListener('animationend', onEnd, { once:true });

    setTimeout(() => {
      try { input.focus({ preventScroll:true }); } catch (e){ input.focus(); }
    }, reduced ? 30 : 80);
  }

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    clearError();
    render();
    if (input.value.length === PIN_LENGTH) attemptUnlock();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    attemptUnlock();
  });

  gate.addEventListener('pointerdown', (e) => {
    if (!card.contains(e.target) || e.target === card) {
      try { input.focus({ preventScroll:true }); } catch (err){ input.focus(); }
    }
  });

  // First interaction anywhere on the gate — typing or tapping — is
  // the audio unlock event. `once:true` on each so this never fires
  // more than it needs to; unlockAudio() itself is also idempotent.
  function unlockAudioOnce(){
    try { if (typeof window.__unlockAudio === 'function') window.__unlockAudio(); } catch (e){ /* non-fatal */ }
  }
  gate.addEventListener('pointerdown', unlockAudioOnce, { capture:true, passive:true, once:true });
  gate.addEventListener('touchstart', unlockAudioOnce, { capture:true, passive:true, once:true });
  input.addEventListener('keydown', unlockAudioOnce, { capture:true, passive:true, once:true });

  function attemptUnlock(){
    if (finished) return;
    const val = input.value.replace(/\D/g, '');
    if (val.length !== PIN_LENGTH || val !== PIN_VALUE){
      shakeError();
      return;
    }
    onCorrectPin();
  }

  function onCorrectPin(){
    input.blur();
    card.classList.add('is-success');

    // Start the soundtrack synchronously, inside this real click/
    // keydown handler — the one moment every mobile browser's
    // autoplay policy actually allows sound to begin. See the hook
    // exposed at the bottom of js/music-player.js.
    try {
      if (typeof window.__startBackgroundMusic === 'function') window.__startBackgroundMusic();
    } catch (e){ console.warn('[pin-intro] music start failed — non-fatal.', e); }

    // A brief success pulse plays on the card first before the gate
    // itself starts leaving, so "correct PIN" reads as its own small
    // moment rather than an instant cut to the next scene.
    const gateLeaveDelay = reduced ? 80 : 500;

    // ---- timing design ----------------------------------------------
    // The flowers get an uninterrupted solo moment first (homepage
    // fully hidden, not just visually underneath), and the homepage
    // only ever crossfades in DURING the flowers' own fade-out — one
    // merged dissolve, not two separately-timed events landing at
    // different moments. That's what makes "homepage becomes visible
    // only once the flower transition is almost finished" true, and
    // what removes the previous abrupt double-exposure (homepage
    // fully visible for ~2s *underneath* still fully-opaque flowers,
    // well before they'd even begun to fade).
    const captionDelay    = reduced ? 60  : 900;   // caption fades in mid-shower
    const soloHold         = reduced ? 220 : 3200;  // flowers-only, homepage fully hidden
    const revealMs          = reduced ? 320 : 1800;  // the one synchronized crossfade
    const homeRevealDelay   = soloHold;               // crossfade starts once the solo hold ends
    const finishAt           = gateLeaveDelay + homeRevealDelay + revealMs + 350;

    // However the reveal above behaves, the visitor must never wait
    // more than this for control of the page — a hard ceiling well
    // past the scripted sequence, covering a backgrounded tab or a
    // missed transition event.
    failSafeTimer = setTimeout(finish, finishAt + 3500);

    setTimeout(() => {
      gate.classList.add('leaving');
      const removeGate = () => { try { if (gate.parentNode) gate.remove(); } catch (e){} };
      gate.addEventListener('transitionend', removeGate, { once:true });
      setTimeout(removeGate, 900); // fallback in case transitionend never fires

      if (veil){
        veil.classList.add('on');
        spawnFlowers();
      }
    }, gateLeaveDelay);

    setTimeout(() => { if (textEl) textEl.classList.add('on'); }, gateLeaveDelay + captionDelay);

    // The one synchronized crossfade: the flower veil fades OUT and the
    // homepage fades IN over the exact same duration, started at the
    // exact same moment, so they visibly dissolve into one another
    // instead of the homepage snapping into view mid-shower. Setting
    // both transition-durations from the same variable (rather than
    // trusting separately-authored CSS durations to happen to match)
    // is what actually guarantees they finish together.
    setTimeout(() => {
      if (textEl) textEl.classList.remove('on');

      if (heroContent){
        heroContent.style.transitionDuration = revealMs + 'ms';
        heroContent.classList.add('reveal');
      }
      if (veilDark){
        veilDark.style.transitionDuration = revealMs + 'ms';
        veilDark.classList.add('cleared');
      }
      if (veil){
        veil.style.transitionDuration = revealMs + 'ms';
        veil.classList.add('fading');
      }

      try { if (typeof playHeroBloom === 'function') playHeroBloom(); } catch (e){ console.warn('[pin-intro] playHeroBloom failed — non-fatal.', e); }
      try { if (typeof initScrollFX === 'function') initScrollFX(); } catch (e){ console.warn('[pin-intro] initScrollFX failed — non-fatal.', e); }
      try { if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start(); } catch (e){ console.warn('[pin-intro] lenis.start() failed.', e); }
    }, gateLeaveDelay + homeRevealDelay);

    setTimeout(finish, finishAt);
  }

  function spawnFlowers(){
    if (!flowersEl) return;

    const species = (typeof CONFIG !== 'undefined' && CONFIG.petals && CONFIG.petals.species && CONFIG.petals.species.length)
      ? CONFIG.petals.species.map(s => s.ch)
      : ['🌸', '🌷', '🌹', '🌺', '💐', '🪷'];

    // Hundreds on desktop; fewer on small/constrained screens so the
    // shower stays smooth — reliability over sheer count, per the brief.
    const w = window.innerWidth;
    let count = w < 640 ? 130 : (w < 1100 ? 190 : 260);
    if (reduced) count = Math.min(count, 40);

    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++){
      const el = document.createElement('span');
      el.className = 'bloom-flower';
      el.setAttribute('aria-hidden', 'true');
      el.textContent = species[(Math.random() * species.length) | 0];

      const size     = 14 + Math.random() * 30;               // different sizes
      const duration = reduced ? 7 : 5 + Math.random() * 6;    // different speeds
      const delay    = -(Math.random() * duration);            // stagger start without extra JS timers
      const drift    = Math.round(Math.random() * 160 - 80) + 'px';
      const spin     = Math.round(Math.random() * 540 - 270) + 'deg'; // different rotations
      const depth    = Math.random();                          // different depth

      el.style.left = (Math.random() * 100) + '%';
      el.style.fontSize = size.toFixed(1) + 'px';
      el.style.opacity = (0.55 + depth * 0.45).toFixed(2);
      el.style.filter = depth < 0.35 ? `blur(${(1.6 - depth * 3).toFixed(1)}px)` : 'none';
      el.style.setProperty('--drift', drift);
      el.style.setProperty('--spin', spin);
      el.style.animationDuration = duration.toFixed(2) + 's';
      el.style.animationDelay = delay.toFixed(2) + 's';

      frag.appendChild(el);
    }
    flowersEl.appendChild(frag);
  }

  render();

  // focus the PIN input as soon as this file runs, so desktop
  // visitors can start typing immediately without an extra click —
  // a short delay on touch devices avoids fighting the page's own
  // load-in focus/scroll behavior.
  setTimeout(() => {
    try { input.focus({ preventScroll:true }); } catch (e){ /* non-fatal — mobile visitors just tap the boxes */ }
  }, reduced ? 0 : 300);

})();
