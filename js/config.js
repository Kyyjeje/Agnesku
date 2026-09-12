/* ============================================================
   CONFIG — the one file to open for behavioral/visual-system
   tuning: flower density, particle "species", device-tier
   presets, and the countdown target.

   Note on scope: page CONTENT (her name, the letter, gallery
   photos, song title, nav labels, intro caption) intentionally
   stays in index.html, not here — that's the more editable place
   for prose and images, and moving it into a JS object would make
   it harder to edit, not easier. This file only holds the numeric
   and structural knobs that shape *behavior*.
============================================================ */
'use strict';

const CONFIG = {

  // Read straight from css/variables.css at runtime, so anything
  // drawn on <canvas> (the flower bloom, confetti, the intro) always
  // matches the palette instead of keeping its own stale copy of it.
  colors: (() => {
    const root = getComputedStyle(document.documentElement);
    const cssVar = (name, fallback) => (root.getPropertyValue(name) || fallback).trim();
    return {
      rose:       cssVar('--rose',        '#e88fa3'),
      roseSoft:   cssVar('--rose-soft',   '#f0b9c4'),
      roseBright: cssVar('--rose-bright', '#ff9fc0'),
      gold:       cssVar('--gold',        '#d9ab72'),
    };
  })(),

  // Petal "species" and how often each shows up in the ambient field,
  // the intro, and the finale burst. Raise/lower `w` (weight) to shift
  // the mix; add a `{ ch, w }` entry to introduce a new flower.
  petals: {
    species: [
      { ch:'🌸', w:9 }, { ch:'🌷', w:6 }, { ch:'🌼', w:6 }, { ch:'🪷', w:5 },
      { ch:'🌹', w:3 }, { ch:'🌺', w:2 }, { ch:'💐', w:1 },
    ],
    spriteSize: 64,
  },

  // "Flower density" from the brief — particle counts per canvas layer
  // (background / midground / foreground) at each device tier, plus
  // the resolution multiplier and whether that layer gets a blur pass.
  // The engine measures real frame time and steps down a tier on its
  // own if a device can't sustain it; this table just sets the ceiling.
  tiers: {
    minimal: { bg:0,  mid:5,  fg:0, dpr:1,   blur:false },
    low:     { bg:8,  mid:10, fg:3, dpr:1,   blur:false },
    medium:  { bg:16, mid:16, fg:5, dpr:1.5, blur:true  },
    high:    { bg:26, mid:22, fg:7, dpr:2,   blur:true  },
  },
  tierOrder: ['minimal', 'low', 'medium', 'high'],

  // Countdown target. Leave exactDate as null to always count down to
  // "one year from today" (a rolling next-birthday, no editing needed
  // ever again). Set a real date to target a specific one instead, e.g.
  //   exactDate: new Date(2027, 2, 14)   // March 14, 2027 — months are 0-indexed
  countdown: {
    exactDate: null,
  },

  // Background soundtrack behavior. `autoStart: true` means the track
  // begins on the visitor's very first interaction anywhere on the
  // page (click/tap/key) — EXCEPT when a PIN gate (js/intro.js) is
  // present in the markup, in which case music-player.js stands down
  // and waits for the gate to explicitly start it once the correct
  // PIN is entered, via window.__startBackgroundMusic(). See
  // js/music-player.js for the unlock mechanics either way.
  audio: {
    autoStart: true,
    fadeMs: 1000,
    targetVolume: 0.85,
    saveIntervalMs: 4000,
    storeKey: 'nabila-garden-audio-state',
  },

  // The gate in front of the site. Change `code` to whatever 4-digit
  // PIN you want visitors to enter — this is the one line most people
  // editing this file actually need to touch.
  pin: {
    code: '1234',
  },

  // The PIN → flower-fall → homepage reveal (js/intro.js). Every
  // duration is in milliseconds, timed from the moment the correct
  // PIN is entered. The flowers spawn ONCE — covering nearly the
  // whole screen immediately — then fall and drift off naturally;
  // nothing is continuously respawned. `counts` mirrors CONFIG.tiers'
  // naming so the flower budget per device tier lives right next to
  // the ambient field's own tiering instead of a second, disconnected
  // scheme.
  flowerReveal: {
    text:            'For Someone Special…',
    // The backdrop now stays dark through most of the fall — flowers
    // spend their first ~half doing the actual "cover the screen and
    // drift" moment before the homepage starts showing through, and
    // it's fully revealed only right at the very end, not partway
    // through a sequence that's still mostly flowers.
    homeRevealDelayMs: 4400,  // when the homepage backdrop starts easing into view
    homeRevealMs:      3400,  // how long that backdrop reveal takes (finishes ~7800ms)
    captionDelayMs:    2600,  // when the caption starts fading in
    maxDurationMs:     8200,  // hard cap — the reveal always finishes by this point
    counts:      { minimal: 10, low: 16, medium: 30, high: 46 }, // total flowers — one wave, so far fewer, far bigger
    sizeMinPx:   90,          // "much larger" flowers, in CSS px — scaled down
    sizeMaxPx:   230,         // per viewport width on small screens, see js/intro.js
  },
};
