/* ============================================================
   AtmosphereEngine — the whole-page light-dust layer. Generates a
   small set of motes once, then hands them entirely to CSS
   keyframes (see .dust-mote in styles/ambient.css) — there is no
   per-frame JS here, so this costs nothing on top of ParticleEngine.

   Deliberately separate from ParticleEngine: the petal canvases are
   a physics system (gravity, wind, pooling); this is a handful of
   static DOM nodes drifting on a loop. Different job, different
   (much simpler) tool — that's the single-responsibility split the
   brief asks for, not an excuse to merge them for fewer files.
============================================================ */

import { QualityManager } from '../core/QualityManager.js';
import { CONFIG } from '../core/ConfigEngine.js';
import { rand } from '../utils/math.js';

export function initAtmosphere() {
  const field = document.getElementById('dustField');
  if (!field || QualityManager.reduceMotion) return;

  const n = CONFIG.tiers[QualityManager.tierName]?.dust ?? 10;
  if (n <= 0) return;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const mote = document.createElement('span');
    mote.className = 'dust-mote';
    const size = rand(2, 5);
    mote.style.left = rand(0, 100) + 'vw';
    mote.style.width = size + 'px';
    mote.style.height = size + 'px';
    mote.style.setProperty('--dust-x', rand(-60, 60) + 'px');
    mote.style.setProperty('--dust-op', rand(0.18, 0.42).toFixed(2));
    const dur = rand(22, 42);
    mote.style.animationDuration = `${dur}s, ${dur}s`;
    mote.style.animationDelay = `${-rand(0, dur)}s, ${-rand(0, dur)}s`;
    frag.appendChild(mote);
  }
  field.appendChild(frag);
}
