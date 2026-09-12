/* ============================================================
   NavigationEngine — the bloom toggle and the full-screen index
   it opens. Exports `closeIndex` and `gardenIndexLinks` as real
   module exports now (ScrollEngine imports them for active-link
   syncing, PageChrome imports closeIndex for anchor clicks) —
   previously these were implicit globals any script-tag could read.
============================================================ */

import { lenis } from '../core/SmoothScroll.js';

const bloomToggle = document.getElementById('bloomToggle');
const gardenIndex = document.getElementById('gardenIndex');
export const gardenIndexLinks = gardenIndex.querySelectorAll('a');

const blockScrollLeak = (e) => e.preventDefault();

function setIndexOpen(open) {
  gardenIndex.classList.toggle('open', open);
  bloomToggle.classList.toggle('open', open);
  bloomToggle.setAttribute('aria-expanded', String(open));
  gardenIndex.setAttribute('aria-hidden', String(!open));
  gardenIndexLinks.forEach((a) => (a.tabIndex = open ? 0 : -1));
  if (open) {
    lenis.stop();
    gardenIndex.addEventListener('wheel', blockScrollLeak, { passive: false });
    gardenIndex.addEventListener('touchmove', blockScrollLeak, { passive: false });
  } else {
    lenis.start();
    gardenIndex.removeEventListener('wheel', blockScrollLeak);
    gardenIndex.removeEventListener('touchmove', blockScrollLeak);
  }
}

export function closeIndex() {
  setIndexOpen(false);
}

export function initNavigationEngine() {
  setIndexOpen(false);

  let toggleLocked = false;
  function syncRevealOrigin() {
    const r = bloomToggle.getBoundingClientRect();
    const x = ((r.left + r.width / 2) / innerWidth) * 100;
    const y = ((r.top + r.height / 2) / innerHeight) * 100;
    gardenIndex.style.setProperty('--reveal-x', x + '%');
    gardenIndex.style.setProperty('--reveal-y', y + '%');
  }
  syncRevealOrigin();
  window.addEventListener('resize', syncRevealOrigin);
  bloomToggle.addEventListener('click', () => {
    if (toggleLocked) return;
    toggleLocked = true;
    syncRevealOrigin();
    setIndexOpen(!gardenIndex.classList.contains('open'));
    setTimeout(() => (toggleLocked = false), 900);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gardenIndex.classList.contains('open')) closeIndex();
  });
}
