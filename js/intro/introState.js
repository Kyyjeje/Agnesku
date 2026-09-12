/* ============================================================
   INTRO ENGINE — introState.js
   The single mutable state object for the intro sequence.
   GSAP tweens properties here rather than tweening DOM directly,
   keeping drawing code declarative: "draw what the state says."

   Modules read from this object every frame; introTimeline.js
   is the only place that writes to it.
============================================================ */
'use strict';

const INTRO_STATE = {
  // ── Lifecycle ────────────────────────────────────────────
  active:    true,
  complete:  false,
  skipped:   false,

  // ── Background ───────────────────────────────────────────
  bgAlpha:   0,   // 0→1: deep plum gradient materialising

  // ── Genesis ──────────────────────────────────────────────
  // The single point of light that is the first thing seen.
  genesisSize:  0,   // 0→1: birth of the first light point
  genesisGlow:  0,   // 0→1: halo expanding around genesis

  // ── Particles ────────────────────────────────────────────
  particleAlpha:    0,  // 0→1: overall particle opacity multiplier
  particleGather:   0,  // 0→1: how much particles pull toward center
  particleOrbit:    0,  // 0→1: orbital motion strength
  particleExpand:   0,  // 0→1: outward expansion at dissolve

  // ── Flowers ──────────────────────────────────────────────
  flowerAlpha:  0,  // 0→1: all flowers' opacity multiplier
  flowerRise:   0,  // 0→1: how high flowers have risen (0=just below screen, 1=at rest)

  // ── Bloom Lighting ───────────────────────────────────────
  bloomIntensity: 0,   // 0→1: central bloom glow
  bloomRadius:    0,   // 0→1: bloom expansion (tweened separately for elastic overshoot)
  raysAlpha:      0,   // 0→1: CSS light-ray layer
  fogAlpha:       0,   // 0→1: soft volumetric fog

  // ── Flash ────────────────────────────────────────────────
  flashIntensity: 0,  // 0→1: lens-flash peak (very brief)

  // ── Typography ───────────────────────────────────────────
  eyebrowAlpha: 0,  // 0→1
  subAlpha:     0,  // 0→1
  nameReveal:   0,  // 0→1 (controls stagger via introTypography)

  // ── Camera (CSS transform on canvas element) ─────────────
  camScale: INTRO_CFG.camera.startScale,
  camX:     0,
  camY:     0,

  // ── Dissolve / Transition ─────────────────────────────────
  overlayAlpha: 1,   // 1→0: whole overlay fading out
  // curtain clip-path is driven directly by CSS class, not this state
};
