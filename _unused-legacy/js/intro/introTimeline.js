/* ============================================================
   INTRO ENGINE — introTimeline.js
   The master GSAP timeline. This is the sole place that writes
   to INTRO_STATE and calls the imperative methods on each module.
   Everything else reads state and draws; only this file decides
   when things happen.

   Reading the timeline tells you exactly what the intro does and
   when — no hunting across modules for sequencing logic.
============================================================ */
'use strict';

const IntroTimeline = (() => {

  let tl = null;

  function build() {
    const T = INTRO_CFG.timing;

    tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => IntroTransition.complete(),
    });

    /* ──────────────────────────────────────────────────────────
       PHASE 0: Genesis — 0 to ~1.5s
       The world breathes into existence from a single point.
    ────────────────────────────────────────────────────────── */
    tl
      // Background gradient materialises — very slowly so the black
      // starting frame truly breathes before anything else moves
      .to(INTRO_STATE, {
        bgAlpha:    1,
        duration:   T.bgFadeDur,
        ease:       'sine.in',
      }, T.bgFadeStart)

      // Genesis: the birth dot with its tiny starburst
      .to(INTRO_STATE, {
        genesisGlow: 1,
        duration:    0.9,
        ease:        'sine.out',
      }, T.genesisDelay)
      .to(INTRO_STATE, {
        genesisSize: 1,
        duration:    0.4,
        ease:        'power3.out',
      }, T.genesisDelay + 0.1)

    /* ──────────────────────────────────────────────────────────
       PHASE 1: Particles — ~0.8s to ~3.0s
       The genesis point fractures; particles orbit inward then find
       their ellipses. Audio fades in beneath.
    ────────────────────────────────────────────────────────── */
      .to(INTRO_STATE, {
        particleAlpha: 1,
        duration:      1.1,
        ease:          'sine.out',
      }, T.particleStart)
      .to(INTRO_STATE, {
        particleGather: 1,
        duration:       1.4,
        ease:           'power2.inOut',
      }, T.particleStart + 0.15)
      .to(INTRO_STATE, {
        particleOrbit:  1,
        duration:       1.8,
        ease:           'elastic.out(0.8, 0.6)',
      }, T.particleStart + 0.5)
      // Audio starts here — user hasn't scrolled, this is the most
      // likely moment the browser autoplay gate is already clear
      .call(() => IntroAudio.start(), null, T.audioFadeIn)

    /* ──────────────────────────────────────────────────────────
       PHASE 2: Flowers — ~2.2s to ~4.5s
       Dreamy flowers rise from below. The genesis dot fades as the
       bloom takes centre stage.
    ────────────────────────────────────────────────────────── */
      .to(INTRO_STATE, {
        flowerAlpha: 1,
        duration:    1.6,
        ease:        'sine.out',
      }, T.flowerStart)
      // Genesis contracts as flowers arrive — it has done its job
      .to(INTRO_STATE, {
        genesisSize: 0,
        genesisGlow: 0,
        duration:    0.8,
        ease:        'sine.in',
      }, T.flowerStart + 0.4)
      // Fog and rays fade up subtly
      .to(INTRO_STATE, {
        fogAlpha:   0.8,
        duration:   1.8,
        ease:       'sine.inOut',
      }, T.flowerStart + 0.2)
      .to(INTRO_STATE, {
        raysAlpha: 1,
        duration:  1.6,
        ease:      'sine.out',
      }, T.raysStart)

    /* ──────────────────────────────────────────────────────────
       PHASE 3: Bloom Lighting — ~3.8s to ~5.0s
       The central bloom expands; the scene is now fully alive.
    ────────────────────────────────────────────────────────── */
      .to(INTRO_STATE, {
        bloomIntensity: 1,
        duration:       1.4,
        ease:           'power2.inOut',
      }, T.bloomPeak - 0.4)
      .to(INTRO_STATE, {
        bloomRadius:    1,
        duration:       1.6,
        ease:           'elastic.out(0.65, 0.55)',
      }, T.bloomPeak - 0.2)
      // Camera pull-back: from startScale toward 1.0
      .to(INTRO_STATE, {
        camScale: INTRO_CFG.camera.endScale,
        duration: 7.0,
        ease:     'sine.inOut',
      }, T.bgFadeStart)

    /* ──────────────────────────────────────────────────────────
       PHASE 4: Typography — ~5.0s to ~7.5s
       Eyebrow → her name → subtitle. The emotional peak.
    ────────────────────────────────────────────────────────── */
      .call(() => IntroTypography.revealEyebrow(), null, T.eyebrowAt)
      .call(() => IntroTypography.revealName(),    null, T.nameAt)
      .call(() => IntroTypography.revealSub(),     null, T.subAt)

    /* ──────────────────────────────────────────────────────────
       PHASE 5: Flash beat — ~7.8s
       A brief lens-flash as the bloom peaks. A single visual
       exclamation mark before the world dissolves into the page.
    ────────────────────────────────────────────────────────── */
      .to(INTRO_STATE, {
        flashIntensity: 1,
        duration: 0.18,
        ease: 'power4.out',
      }, T.flashAt)
      .to(INTRO_STATE, {
        flashIntensity: 0,
        duration: 0.55,
        ease: 'power2.in',
      }, T.flashAt + 0.18)

    /* ──────────────────────────────────────────────────────────
       PHASE 6: Dissolve — ~8.2s to ~9.6s
       Everything fades together. The curtain bloom-wipes away.
       Page content crossfades in underneath — one continuous garden.
    ────────────────────────────────────────────────────────── */
      .call(() => IntroTransition.begin(), null, T.dissolveAt)
      .call(() => IntroTypography.dissolve(), null, T.dissolveAt)
      // Rays and fog fade before canvas
      .to(INTRO_STATE, {
        raysAlpha:      0,
        fogAlpha:       0,
        bloomIntensity: 0,
        duration:       0.8,
        ease:           'sine.in',
      }, T.dissolveAt)
      .to(INTRO_STATE, {
        flowerAlpha:   0,
        particleAlpha: 0,
        duration:      1.0,
        ease:          'sine.in',
      }, T.dissolveAt + 0.1)
      .to(INTRO_STATE, {
        bgAlpha:       0,
        duration:      0.9,
        ease:          'sine.in',
      }, T.dissolveAt + 0.2)
      // Whole overlay fade
      .to('#ie-root', {
        opacity:       0,
        duration:      INTRO_CFG.transition.overlayFade,
        ease:          'sine.in',
      }, T.dissolveAt + 0.3);

    return tl;
  }

  function skip() {
    if (tl) {
      // Jump directly to just before the dissolve so it still plays
      // the curtain transition rather than hard-cutting
      tl.seek(INTRO_CFG.timing.dissolveAt - 0.1, false);
    }
  }

  function destroy() {
    if (tl) { tl.kill(); tl = null; }
  }

  return { build, skip, destroy };

})();
