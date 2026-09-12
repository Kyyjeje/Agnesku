/* ============================================================
   Hero — the live greeting and the centerpiece bloom SVG. Magnetic
   hover and the trailing cursor moved to engines/CursorEngine.js
   (they're pointer-position concerns, not hero-specific); this
   module keeps only what's actually about the hero section itself.

   playHeroBloom fires on the 'hero:bloom' bus event from
   SceneEngine, instead of SceneEngine importing this module and
   calling it directly.
============================================================ */

import { gsap } from '../core/SmoothScroll.js';
import { QualityManager } from '../core/QualityManager.js';
import { bus } from '../core/EventBus.js';

function greet() {
  const eyebrow = document.getElementById('heroEyebrow');
  if (!eyebrow) return;
  const h = new Date().getHours();
  const greeting = h < 5 ? 'Still awake this late'
    : h < 12 ? 'Good morning'
    : h < 17 ? 'Good afternoon'
    : h < 21 ? 'Good evening'
    : 'Good night';
  const rest = eyebrow.textContent;
  eyebrow.textContent = `${greeting} — ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
}

function playHeroBloom() {
  const g = document.getElementById('heroBloomGroup');
  if (!g) return; // the hero-bloom decoration was removed from this build — nothing to do
  const petalCount = 10;
  const colors = ['var(--rose)', 'var(--rose-soft)', 'var(--rose-bright)'];
  const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < petalCount; i++) {
    const angle = (360 / petalCount) * i;
    const long = i % 2 === 0;
    const p = document.createElementNS(ns, 'ellipse');
    p.setAttribute('cx', 0); p.setAttribute('cy', long ? -95 : -70);
    p.setAttribute('rx', long ? 34 : 26); p.setAttribute('ry', long ? 95 : 70);
    p.setAttribute('fill', colors[i % colors.length]);
    p.setAttribute('opacity', '0.85');
    p.setAttribute('transform', `rotate(${angle}) scale(0.05)`);
    p.style.transformOrigin = '0px 0px';
    g.appendChild(p);
    gsap.to(p, { attr: { transform: `rotate(${angle}) scale(1)` }, duration: 2, delay: i * 0.045, ease: 'elastic.out(0.7,0.55)' });
  }
  const core = document.createElementNS(ns, 'circle');
  core.setAttribute('r', '30'); core.setAttribute('fill', 'var(--gold)'); core.setAttribute('opacity', '0');
  g.appendChild(core);
  gsap.to(core, { opacity: 0.95, duration: 1, delay: 1.1 });
  if (!QualityManager.reduceMotion) gsap.to(g, { rotation: 360, duration: 190, repeat: -1, ease: 'none', transformOrigin: '0px 0px' });
}

export function initHero() {
  greet();
  bus.on('hero:bloom', playHeroBloom);
}
