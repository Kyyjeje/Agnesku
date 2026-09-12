import { CONFIG } from './ConfigEngine.js';
import { bus } from './EventBus.js';

/* ============================================================
   QualityManager — the single source of truth for "how much can
   this device handle". Previously this same detection block was
   copy-pasted into the petal engine and an unused legacy main.js;
   now every effect (particles, dust motes, cursor glow, gallery
   blur) reads its ceiling from one place and reacts to the same
   `quality:change` event when the live monitor steps a tier down.
============================================================ */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoverCapable = matchMedia('(hover:hover) and (pointer:fine)').matches;

function detectInitialTier() {
  if (reduceMotion) return 'minimal';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const mobile = matchMedia('(max-width:700px)').matches;
  if (mobile && (cores <= 4 || mem <= 4)) return 'low';
  if (cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

class QualityManagerImpl {
  constructor() {
    this.reduceMotion = reduceMotion;
    this.hoverCapable = hoverCapable;
    this.tierName = detectInitialTier();
    // frame-time samples for the live monitor (see sample())
    this._frameSamples = [];
  }

  get tier() {
    return CONFIG.tiers[this.tierName];
  }

  /** Feed a measured frame delta (ms) in from whichever engine is
   *  already running a rAF loop (the particle engine). Steps the
   *  tier down automatically if sustained frame time is too high,
   *  and never steps back up mid-session (avoids visible flicker
   *  between quality levels). */
  sample(deltaMs) {
    if (this.tierName === 'minimal') return;
    this._frameSamples.push(deltaMs);
    if (this._frameSamples.length < 90) return; // ~1.5s at 60fps
    const avg = this._frameSamples.reduce((a, b) => a + b, 0) / this._frameSamples.length;
    this._frameSamples.length = 0;
    if (avg > 28) this.stepDown(); // sustained sub-~35fps
  }

  stepDown() {
    const idx = CONFIG.tierOrder.indexOf(this.tierName);
    if (idx <= 0) return;
    this.tierName = CONFIG.tierOrder[idx - 1];
    bus.emit('quality:change', { tierName: this.tierName, tier: this.tier });
  }
}

export const QualityManager = new QualityManagerImpl();
