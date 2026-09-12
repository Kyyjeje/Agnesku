/* ============================================================
   PIN INTRO — replaces the old canvas/GSAP intro engine entirely.
   Deliberately simple: plain DOM + CSS transitions/animations, no
   canvas, no GSAP, no timeline library. That's the actual fix for
   "unstable on mobile, gets stuck" — the old engine's biggest risk
   surface was its own complexity (a hand-rolled canvas draw loop,
   a ~15-tween GSAP timeline, a third-party smooth-scroll dependency
   all needing to hand off to each other cleanly). This file has far
   fewer moving parts, so there's far less that can jam.

   Flow:
     1. #pinGate is in the markup already, visible on first paint —
        no JS needed for the PIN screen to "appear immediately".
     2. Correct PIN → start music synchronously (same trusted
        gesture), darken the screen, shower CSS-only flower spans,
        show a short line of text.
     3. Homepage fades in behind the flowers; scroll unlocks.
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
  const form        = document.getElementById('pinForm');
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
  if (!gate || !form || !input){
    finish();
    return;
  }

  const PIN = String((typeof CONFIG !== 'undefined' && CONFIG.pin && CONFIG.pin.code) || '0000');

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 8);
    if (errorEl) errorEl.textContent = '';
    gate.classList.remove('pin-shake');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (finished) return;

    if (input.value.trim() !== PIN){
      if (errorEl) errorEl.textContent = "That's not quite it — try again.";
      gate.classList.remove('pin-shake');
      void gate.offsetWidth; // restart the shake animation on repeat wrong entries
      gate.classList.add('pin-shake');
      input.value = '';
      input.focus();
      return;
    }

    onCorrectPin();
  });

  function onCorrectPin(){
    // Start the soundtrack synchronously, inside this real click/
    // keydown handler — the one moment every mobile browser's
    // autoplay policy actually allows sound to begin. See the hook
    // exposed at the bottom of js/music-player.js.
    try {
      if (typeof window.__startBackgroundMusic === 'function') window.__startBackgroundMusic();
    } catch (e){ console.warn('[pin-intro] music start failed — non-fatal.', e); }

    // However the reveal below behaves, the visitor must never wait
    // more than this long for control of the page. The scripted
    // sequence finishes on its own at ~4.9s; this is a hard ceiling
    // well past that, covering a backgrounded tab or a missed event.
    failSafeTimer = setTimeout(finish, 9000);

    gate.classList.add('leaving');
    gate.addEventListener('transitionend', removeGate, { once:true });
    setTimeout(removeGate, 900); // fallback in case transitionend never fires
    function removeGate(){ try { if (gate.parentNode) gate.remove(); } catch (e){} }

    if (veil){
      veil.classList.add('on');
      spawnFlowers();
    }

    setTimeout(() => { if (textEl) textEl.classList.add('on'); }, 350);

    // homepage gradually revealed behind the falling flowers
    setTimeout(() => {
      if (veilDark) veilDark.classList.add('cleared');
      if (heroContent) heroContent.classList.add('reveal');
      try { if (typeof playHeroBloom === 'function') playHeroBloom(); } catch (e){ console.warn('[pin-intro] playHeroBloom failed — non-fatal.', e); }
      try { if (typeof initScrollFX === 'function') initScrollFX(); } catch (e){ console.warn('[pin-intro] initScrollFX failed — non-fatal.', e); }
      try { if (window.lenis && typeof window.lenis.start === 'function') window.lenis.start(); } catch (e){ console.warn('[pin-intro] lenis.start() failed.', e); }
    }, 1900);

    // flowers slowly disappear while the homepage stays fully
    // interactive underneath (it already unlocked above)
    setTimeout(() => {
      if (textEl) textEl.classList.remove('on');
      if (veil) veil.classList.add('fading');
    }, 4000);

    setTimeout(finish, 4900);
  }

  function spawnFlowers(){
    if (!flowersEl) return;

    const species = (typeof CONFIG !== 'undefined' && CONFIG.petals && CONFIG.petals.species && CONFIG.petals.species.length)
      ? CONFIG.petals.species.map(s => s.ch)
      : ['🌸', '🌷', '🌹', '🌺', '💐', '🪷'];

    // Hundreds on desktop; fewer on small/constrained screens so the
    // shower stays smooth rather than "reliable" being sacrificed for
    // sheer count — reliability over complex animation, per the brief.
    const w = window.innerWidth;
    let count = w < 640 ? 130 : (w < 1100 ? 190 : 260);
    if (typeof reduceMotion !== 'undefined' && reduceMotion) count = Math.min(count, 40);

    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++){
      const el = document.createElement('span');
      el.className = 'bloom-flower';
      el.setAttribute('aria-hidden', 'true');
      el.textContent = species[(Math.random() * species.length) | 0];

      const size     = 14 + Math.random() * 30;               // different sizes
      const duration = (typeof reduceMotion !== 'undefined' && reduceMotion) ? 7 : 5 + Math.random() * 6; // different speeds
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

  // focus the PIN input as soon as this file runs, so desktop
  // visitors can start typing immediately without an extra click
  try { input.focus({ preventScroll:true }); } catch (e){ /* non-fatal */ }

})();
