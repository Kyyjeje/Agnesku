/* ============================================================
   ConfigEngine — the one module that owns tunable numbers, so
   they don't live scattered as magic values through every
   subsystem. Anything a future edit is likely to touch (the
   birthday date, audio fade timing, flower mix) reads from here.

   Scope note (unchanged from the original build): page CONTENT
   (her name, the letter, gallery photos, song title, nav labels)
   deliberately stays in index.html, not here — that stays the
   easiest place to edit prose and images. This file only holds
   the numeric/structural knobs that shape *behavior*.
============================================================ */

function readCssVar(name, fallback) {
  const root = getComputedStyle(document.documentElement);
  const val = root.getPropertyValue(name);
  return (val || fallback).trim();
}

export const CONFIG = {
  // Read live from css/variables.css so anything drawn on <canvas>
  // (petals, confetti, the intro) always matches the palette
  // instead of keeping its own stale copy of it.
  get colors() {
    return {
      rose: readCssVar('--rose', '#e88fa3'),
      roseSoft: readCssVar('--rose-soft', '#f0b9c4'),
      roseBright: readCssVar('--rose-bright', '#ff9fc0'),
      gold: readCssVar('--gold', '#d9ab72'),
    };
  },

  petals: {
    species: [
      { ch: '🌸', w: 9 }, { ch: '🌷', w: 6 }, { ch: '🌼', w: 6 }, { ch: '🪷', w: 5 },
      { ch: '🌹', w: 3 }, { ch: '🌺', w: 2 }, { ch: '💐', w: 1 },
    ],
    spriteSize: 64,
  },

  // Particle ceilings per device tier. QualityManager measures real
  // frame time and steps down a tier on its own if a device can't
  // sustain it — this table just sets the per-tier ceiling.
  tiers: {
    minimal: { bg: 0, mid: 5, fg: 0, dpr: 1, blur: false, dust: 0, cursorGlow: false },
    low: { bg: 8, mid: 10, fg: 3, dpr: 1, blur: false, dust: 6, cursorGlow: false },
    medium: { bg: 16, mid: 16, fg: 5, dpr: 1.5, blur: true, dust: 11, cursorGlow: true },
    high: { bg: 26, mid: 22, fg: 7, dpr: 2, blur: true, dust: 16, cursorGlow: true },
  },
  tierOrder: ['minimal', 'low', 'medium', 'high'],

  audio: {
    storeKey: 'nabila-garden-song-state',
    fadeMs: 900,
    targetVolume: 0.85,
    saveIntervalMs: 4000,
  },

  // Countdown target. Leave exactDate as null to always count down to
  // "one year from today" (a rolling next birthday, no editing ever
  // needed again). Set a real date to target a specific one instead:
  //   exactDate: new Date(2027, 2, 14)   // March 14, 2027 (0-indexed months)
  countdown: {
    exactDate: null,
  },

  // New in this pass: the gallery lightbox and cursor-glow features.
  lightbox: {
    // how long the glass-blur reveal takes when a photo opens, ms
    openMs: 420,
  },
  cursor: {
    glowSize: 220,
    glowFollowEase: 0.16,
  },
};
