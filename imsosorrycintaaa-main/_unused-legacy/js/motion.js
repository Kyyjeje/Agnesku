/* ============================================================
   MOTION — the site's one shared choreography language. Every
   engine (intro, hero, scroll-reveal, atmosphere) pulls its
   easing curves and durations from here instead of inventing its
   own numbers, so a scroll feels like the same "camera operator"
   directed the intro. Change the rhythm of the whole site once,
   here, rather than hunting through five files.

   Loads right after utils.js — everything downstream depends on it.
============================================================ */
'use strict';

const MOTION = {
  ease: {
    lux:     'cubic-bezier(.22,1,.36,1)',   // slow arrival, no bounce — the "camera settles" curve
    soft:    'cubic-bezier(.16,.84,.44,1)', // gentle content reveals
    drift:   'sine.inOut',                  // ambient, cyclical motion (motes, glow, drift flowers)
    arrive:  'power3.out',                  // decisive but unhurried entrances
    bloom:   'elastic.out(0.7,0.6)',        // the one place bounce is allowed — things opening
  },
  dur: {
    breath:  4.2,   // one full ambient glow cycle
    reveal:  1.1,   // a section/element arriving
    slow:    1.6,   // the intro's major beats
    dissolve:1.0,   // handoff transitions
  },
  // a scene is a named beat in the intro→hero→scroll story, so any
  // module can ask "what part of the experience are we in" without
  // re-deriving it from scroll position or a boolean flag
  scene: 'intro', // intro → hero → scrolling
  setScene(name){ this.scene = name; document.body.dataset.scene = name; },
};
