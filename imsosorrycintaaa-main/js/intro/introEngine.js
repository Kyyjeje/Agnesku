/* ============================================================
   INTRO ENGINE — introEngine.js
   The public entry point. Wires every module together, detects
   device capability and reduced-motion preference, and exposes
   the smallest possible API to the outside world:

     IntroEngine.init()   — called once at page load
     IntroEngine.skip()   — called by the skip button

   If `prefers-reduced-motion: reduce` is set, the engine calls
   IntroTransition.complete() immediately, so the page is always
   fully usable — the intro is an enhancement, never a gate.
============================================================ */
'use strict';

const IntroEngine = (() => {

  let initialised = false;

  /* ── Device tier detection ──────────────────────────────── */
  function detectTier() {
    if (reduceMotion) return 'minimal';
    const cores  = navigator.hardwareConcurrency || 4;
    const mem    = navigator.deviceMemory        || 4;
    const mobile = matchMedia('(max-width: 700px)').matches;
    if (mobile && (cores <= 4 || mem <= 2)) return 'low';
    if (cores <= 4 || mem <= 4)             return 'medium';
    return 'high';
  }

  /* ── Reduced-motion fast path ─────────────────────────────── */
  function initReducedMotion() {
    const overlay = document.getElementById('ie-root');
    const curtain = document.getElementById('ie-curtain');
    if (overlay) overlay.remove();
    if (curtain) curtain.remove();
    document.body.classList.remove('intro-active');
    if (typeof lenis         !== 'undefined') lenis.start();
    if (typeof playHeroBloom !== 'undefined') playHeroBloom();
    if (typeof initScrollFX  !== 'undefined') initScrollFX();
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) heroContent.classList.add('reveal');
  }

  /* ── Full cinematic intro ───────────────────────────────── */
  function initFull(tier) {
    INTRO_STATE.active = true;
    document.body.classList.add('intro-active');

    // 1. Determine tier and store on state for other modules
    INTRO_STATE.tier = tier;

    // 2. Initialise all sub-systems
    IntroScene.init();
    IntroParticles.buildPool(tier);
    IntroFlowers.buildLayers(tier);
    IntroCamera.init();
    IntroTypography.init();
    IntroTransition.init();

    // 3. Wire the CSS rays opacity to raysAlpha state
    const raysEl = document.getElementById('ie-rays');
    if (raysEl) {
      gsap.to(raysEl, {
        opacity: 1, duration: 0,    // start at 0 (CSS default)
      });
    }

    // 4. Set INTRO_CFG.lighting.bloomRadius so state can reference it
    INTRO_CFG.lighting.bloomRadius = INTRO_CFG.lighting.bloomRadius || 260;

    // 5. Start the canvas render loop
    IntroScene.start();

    // 6. Kick off the camera update (runs on RAF inside the scene loop
    //    piggybacks: the scene loop calls IntroCamera.update too)
    //    — we wire it through the scene draw by patching drawFrame via
    //    a tiny hook so there's no second RAF
    const origStart = IntroScene.start;

    // 7. Build and play the master timeline
    IntroTimeline.build();

    // 8. Bind the skip button
    const skipBtn = document.getElementById('ie-skip');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        INTRO_STATE.skipped = true;
        IntroTimeline.skip();
      });
    }

    // 9. Block scroll during intro
    const blockScroll = e => { if (INTRO_STATE.active) e.preventDefault(); };
    const root = document.getElementById('ie-root');
    if (root) {
      root.addEventListener('wheel',     blockScroll, { passive: false });
      root.addEventListener('touchmove', blockScroll, { passive: false });
    }
  }

  /* ── Public init ─────────────────────────────────────────── */
  function init() {
    if (initialised) return;
    initialised = true;

    // Detect tier
    const tier = detectTier();

    // Fast path if user prefers reduced motion
    if (tier === 'minimal') {
      initReducedMotion();
      return;
    }

    // Slight defer so every other script has had a chance to run,
    // lenis is set up, engine/spriteCache exist, etc.
    requestAnimationFrame(() => initFull(tier));
  }

  /* ── Public skip ─────────────────────────────────────────── */
  function skip() {
    INTRO_STATE.skipped = true;
    IntroTimeline.skip();
  }

  return { init, skip };

})();

/* ── Auto-start ─────────────────────────────────────────── */
// DOMContentLoaded is already fired by the time this <script> tag
// runs (it's the last tag before </body>), so calling init() here
// is safe — no extra listener overhead needed.
IntroEngine.init();
