/* ============================================================
   ATMOSPHERE — the whole-page light-dust layer. Generates a small
   set of motes once, then hands them entirely to CSS keyframes
   (see .dust-mote in css/ambient.css) — there is no per-frame JS
   here, so this costs nothing on top of the existing petal engine.

   Deliberately separate from petals-engine.js: the petal canvases
   are a physics system (gravity, wind, pooling); this is just a
   handful of static DOM nodes drifting on a loop. Different job,
   different (much simpler) tool.

   Skips entirely under reduced motion, and scales down on the
   lowest device tier rather than adding to an already-constrained
   frame budget.
============================================================ */
'use strict';

(function initAtmosphere(){
  const field = document.getElementById('dustField');
  if (!field || reduceMotion) return;

  const counts = { minimal:0, low:6, medium:11, high:16 };
  const n = counts[tierName] ?? 10;
  if (n <= 0) return;

  const frag = document.createDocumentFragment();
  for (let i=0;i<n;i++){
    const mote = document.createElement('span');
    mote.className = 'dust-mote';
    const size = rand(2, 5);
    mote.style.left = rand(0,100)+'vw';
    mote.style.width = size+'px';
    mote.style.height = size+'px';
    mote.style.setProperty('--dust-x', rand(-60,60)+'px');
    mote.style.setProperty('--dust-op', rand(.18,.42).toFixed(2));
    const dur = rand(22, 42);
    mote.style.animationDuration = `${dur}s, ${dur}s`;
    mote.style.animationDelay = `${-rand(0,dur)}s, ${-rand(0,dur)}s`;
    frag.appendChild(mote);
  }
  field.appendChild(frag);
})();
