/* ============================================================
   GalleryLightbox — new in this pass. Builds the lightbox DOM once,
   populates it from whatever .press-card figures already exist in
   the gallery (never a hard-coded photo list, matching the site's
   existing "never hard-coded" philosophy for the memory counter).
   Uses MotionEngine's blurReveal/blurDismiss presets for the open/
   close motion so the "premium glass" feel is consistent with any
   future reveal moment that reaches for the same preset.
============================================================ */

import { blurReveal, blurDismiss } from '../engines/MotionEngine.js';
import { lenis } from '../core/SmoothScroll.js';
import { $$ } from '../utils/dom.js';

export function initGalleryLightbox() {
  const cards = $$('.press-card');
  if (!cards.length) return;

  const photos = cards.map((card) => ({
    src: card.querySelector('img')?.src,
    alt: card.querySelector('img')?.alt || '',
    caption: card.querySelector('.cap')?.textContent || '',
    tag: card.querySelector('.tag')?.textContent || '',
  }));

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19"/></svg>
    </button>
    <button type="button" class="lightbox-nav prev" aria-label="Previous photo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 5l-7 7 7 7"/></svg>
    </button>
    <button type="button" class="lightbox-nav next" aria-label="Next photo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 5l7 7-7 7"/></svg>
    </button>
    <div class="lightbox-frame">
      <span class="lightbox-tag"></span>
      <img alt="" />
      <p class="lightbox-cap"></p>
    </div>
  `;
  document.body.appendChild(box);

  const imgEl = box.querySelector('img');
  const capEl = box.querySelector('.lightbox-cap');
  const tagEl = box.querySelector('.lightbox-tag');
  const frame = box.querySelector('.lightbox-frame');

  let index = 0;
  let openTween = null;

  function render() {
    const p = photos[index];
    imgEl.src = p.src;
    imgEl.alt = p.alt;
    capEl.textContent = p.caption;
    tagEl.textContent = p.tag;
  }

  function open(i) {
    index = i;
    render();
    box.classList.add('open');
    lenis.stop();
    openTween?.kill();
    openTween = blurReveal(frame);
  }

  function close() {
    openTween?.kill();
    blurDismiss(frame, {
      onComplete: () => {
        box.classList.remove('open');
        lenis.start();
      },
    });
  }

  function step(delta) {
    index = (index + delta + photos.length) % photos.length;
    render();
    blurReveal(frame, { duration: 0.3, fromScale: 1.02, blurPx: 8 });
  }

  cards.forEach((card, i) => {
    card.addEventListener('click', () => open(i));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
    });
  });

  box.querySelector('.lightbox-close').addEventListener('click', close);
  box.querySelector('.lightbox-nav.prev').addEventListener('click', () => step(-1));
  box.querySelector('.lightbox-nav.next').addEventListener('click', () => step(1));
  box.addEventListener('click', (e) => { if (e.target === box) close(); });

  document.addEventListener('keydown', (e) => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
}
