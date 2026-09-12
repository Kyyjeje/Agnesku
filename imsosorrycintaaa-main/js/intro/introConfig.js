/* ============================================================
   INTRO ENGINE — introConfig.js
   All configuration for the cinematic intro sequence.
   Read-only at runtime. Tune values here, never inside the
   drawing or timeline modules.
============================================================ */
'use strict';

const INTRO_CFG = Object.freeze({

  // ── TIMING (seconds) ──────────────────────────────────────
  timing: {
    genesisDelay:  0.25,  // delay before first light appears
    bgFadeStart:   0.40,  // when background gradient begins
    bgFadeDur:     2.80,  // how long bg takes to fully materialise
    particleStart: 0.80,  // particles begin orbiting
    audioFadeIn:   1.40,  // ambient sound starts
    flowerStart:   2.20,  // flowers begin rising
    raysStart:     3.00,  // CSS light rays fade up
    bloomPeak:     3.80,  // central bloom at full intensity
    eyebrowAt:     5.00,  // eyebrow text appears
    nameAt:        5.60,  // name letters begin blooming
    subAt:         7.00,  // subtitle appears
    holdEnd:       7.80,  // held beat ends
    flashAt:       7.80,  // lens-flash beat
    dissolveAt:    8.20,  // fade-to-page begins
    curtainAt:     8.40,  // bloom-wipe curtain retracts
    completeAt:    9.60,  // engine fully tears down
  },

  // ── PARTICLES ─────────────────────────────────────────────
  particles: {
    // per-tier count (background motes / orbital)
    counts: { minimal: 0, low: 14, medium: 28, high: 44 },
    // genesis point: single origin before fracturing
    genesisRadius: 1.5,   // px
    // orbit parameters
    orbitRadiusMin: 38,   // px
    orbitRadiusMax: 210,  // px
    orbitSpeedMin:  0.00022,
    orbitSpeedMax:  0.00068,
    sizeMin: 1.0,
    sizeMax: 3.4,
    // trail
    trailLength: 0.18,    // fraction of orbit circumference kept
    // glow
    glowBlur: 7,
  },

  // ── FLOWERS ───────────────────────────────────────────────
  flowers: {
    counts: { minimal: 0, low: 4, medium: 8, high: 14 },
    sizeMin:   22,
    sizeMax:   74,
    speedMin:  0.018,   // fraction of screen height per second
    speedMax:  0.052,
    wobbleAmt: 22,      // horizontal sway in px
    wobbleSpd: 0.00045,
    spinMax:   0.00040,
    // three depth layers: far (back), mid, near (front)
    layers: [
      { z: 0.2, opacityRange: [0.12, 0.22], sizeMul: 0.55, speedMul: 0.55 },
      { z: 0.5, opacityRange: [0.28, 0.48], sizeMul: 1.00, speedMul: 1.00 },
      { z: 0.8, opacityRange: [0.50, 0.80], sizeMul: 1.40, speedMul: 1.35 },
    ],
  },

  // ── LIGHTING ──────────────────────────────────────────────
  lighting: {
    bloomRadius:     260,   // px at full intensity
    bloomRadiusMin:  40,
    bloomPulseAmt:   0.06,  // subtle breathing amplitude
    bloomPulseSpeed: 0.0008,
    genesisFlare:    true,  // tiny starburst when first light appears
    flashDuration:   0.28,  // seconds
  },

  // ── TYPOGRAPHY ────────────────────────────────────────────
  typography: {
    name:    'Nabila',
    eyebrow: 'a garden, grown for you',
    sub:     'in full bloom today',
    letterStagger: 0.072, // seconds between each letter
    letterBloomRadius: 24, // canvas glow circle per letter (px)
  },

  // ── AUDIO ─────────────────────────────────────────────────
  audio: {
    enabled: true,
    // A-major pad: A3 + E4 + A4 (romantic, warm)
    frequencies: [220, 329.63, 440, 554.37],
    fadeInDur:   3.0,   // seconds to reach full volume
    peakGain:    0.06,  // master gain peak (quiet — ambience, not music)
    fadeOutDur:  2.2,
    tremoloRate: 0.22,  // Hz — very slow breath
    tremoloDepth: 0.08,
  },

  // ── CAMERA ────────────────────────────────────────────────
  camera: {
    startScale:  1.05,   // slight zoom in at start
    endScale:    1.00,   // "pulls back" as world expands
    driftX:      8,      // px of slow horizontal drift
    driftY:      5,
    driftPeriod: 12.0,   // seconds for one full drift cycle
  },

  // ── TRANSITION ────────────────────────────────────────────
  transition: {
    curtainDur:   1.30,  // bloom-wipe clip-path animation
    overlayFade:  0.90,
  },

  // ── COLORS (mirror css/variables.css for canvas use) ──────
  colors: {
    genesis:    '#ffffff',
    light:      '#fff4f8',
    rose:       '#e88fa3',
    roseSoft:   '#f0b9c4',
    roseBright: '#ff9fc0',
    gold:       '#d9ab72',
    plum:       '#2a1520',
    deep:       '#170d13',
    // particle glow colors (slightly varied to avoid monotony)
    moteA:      '#ffeaf2',
    moteB:      '#e8c8d8',
    moteC:      '#f0d8b0',
  },

});
