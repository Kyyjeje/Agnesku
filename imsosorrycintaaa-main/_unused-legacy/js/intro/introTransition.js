/* ============================================================
   INTRO ENGINE — introTransition.js
   The invisible seam between the intro world and the homepage.

   Strategy:
     1. A dark "curtain" div (z-index 190) covers the page content
        below the intro overlay (z-index 200) during the whole intro.
     2. When dissolve begins, the intro overlay fades out (GSAP, in
        introTimeline.js) while simultaneously the curtain's
        clip-path is animated from `inset(0)` to
        `circle(0% at 50% 50%)` — collapsing it into a bloom-point
        at center and revealing the live page behind it.
     3. The hero content's `.reveal` class is added at the same
        moment, so it fades in from within the opening bloom circle.
     4. Once the curtain has fully retracted, the intro overlay is
        removed from the DOM and the engine tears down.

   This makes the transition feel like the garden itself is opening
   rather than one screen replacing another.
============================================================ */
'use strict';

const IntroTransition = (() => {

  let curtain     = null;
  let heroContent = null;
  let overlay     = null;

  function init() {
    curtain     = document.getElementById('ie-curtain');
    heroContent = document.querySelector('.hero-content');
    overlay     = document.getElementById('ie-root');
  }

  /* ── begin() — called ~0.4s before overlay fully fades ──── */
  function begin() {
    IntroAudio.fadeOut();
    IntroCamera.stop();

    // Show hero content underneath before the curtain retracts,
    // so it's "there" as the bloom opens
    if (heroContent) heroContent.classList.add('reveal');

    // A short beat, then retract the curtain with bloom-wipe
    setTimeout(() => {
      if (curtain) curtain.classList.add('ie-curtain--bloom');
    }, (INTRO_CFG.transition.curtainDur * 400) | 0);
  }

  /* ── complete() — called when GSAP timeline onComplete fires */
  function complete() {
    if (!INTRO_STATE.active) return;
    INTRO_STATE.active   = false;
    INTRO_STATE.complete = true;

    IntroScene.stop();
    IntroAudio.destroy();

    // Remove overlay entirely from the DOM (no lingering paint cost)
    if (overlay) {
      overlay.style.pointerEvents = 'none';
      setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        // Remove curtain too — page is fully visible
        if (curtain && curtain.parentNode) {
          curtain.parentNode.removeChild(curtain);
        }
      }, 200);
    }

    document.body.classList.remove('intro-active');

    // Hand off to the rest of the page
    if (typeof lenis       !== 'undefined') lenis.start();
    if (typeof playHeroBloom !== 'undefined') playHeroBloom();
    if (typeof initScrollFX  !== 'undefined') initScrollFX();
  }

  return { init, begin, complete };

})();
