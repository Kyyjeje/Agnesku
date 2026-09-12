/* ============================================================
   PageChrome — cross-cutting concerns that don't belong to one
   feature module: in-page anchor smooth-scrolling and the finale
   confetti button. (Renamed from "app.js" — "PageChrome" says
   what it actually does.)
============================================================ */

import confetti from 'canvas-confetti';
import { lenis } from '../core/SmoothScroll.js';
import { CONFIG } from '../core/ConfigEngine.js';
import { bus } from '../core/EventBus.js';
import { closeIndex } from '../engines/NavigationEngine.js';
import { $$ } from '../utils/dom.js';

export function initPageChrome() {
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.querySelector(a.getAttribute('href'));
      if (el) lenis.scrollTo(el, { offset: 0, duration: 1.3 });
      closeIndex();
    });
  });

  const confettiBtn = document.getElementById('confettiBtn');
  if (confettiBtn) {
    confettiBtn.addEventListener('click', (e) => {
      const colors = [CONFIG.colors.rose, CONFIG.colors.roseSoft, CONFIG.colors.gold, CONFIG.colors.roseBright];
      confetti({ particleCount: 120, spread: 100, startVelocity: 36, gravity: 0.7, scalar: 1.1, colors, origin: { y: 0.7 } });
      confetti({ particleCount: 50, spread: 140, startVelocity: 20, gravity: 0.5, scalar: 0.8, colors, origin: { y: 0.6 }, angle: 60 });
      confetti({ particleCount: 50, spread: 140, startVelocity: 20, gravity: 0.5, scalar: 0.8, colors, origin: { y: 0.6 }, angle: 120 });
      const r = e.currentTarget.getBoundingClientRect();
      bus.emit('petals:burst', { x: r.left + r.width / 2, y: r.top, count: 22, opts: { spread: Math.PI * 1.4, minSpeed: 2, maxSpeed: 6, gravity: 0.1 } });
    });
  }
}
