/* ============================================================
   CursorEngine — everything driven by pointer position: the
   magnetic pull on [data-magnetic] buttons, the trailing petal
   cursor, and the new soft cursor-glow. One module because all
   three read the same mousemove stream and the same hover-capable
   gate; splitting them into three files would just mean three
   separate `mousemove` listeners doing the same job.

   Cursor glow is new in this pass. It's gated on QualityManager's
   tier (off on 'low'/'minimal') so it never costs anything on a
   device that's already struggling to keep the petals smooth.
============================================================ */

import gsap from 'gsap';
import { CONFIG } from '../core/ConfigEngine.js';
import { QualityManager } from '../core/QualityManager.js';
import { $$ } from '../utils/dom.js';
import { lerp } from '../utils/math.js';

export function initCursorEngine() {
  if (!QualityManager.hoverCapable) return;

  /* ---- magnetic CTAs ---- */
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.3;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.4;
      gsap.to(el, { x: dx, y: dy, duration: 0.4, ease: 'power2.out' });
    });
    el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,0.5)' }));
  });

  /* ---- trailing petal cursor ---- */
  const cursor = document.getElementById('petalCursor');
  if (cursor) {
    window.addEventListener('mousemove', (e) => {
      cursor.classList.add('active');
      gsap.to(cursor, { x: e.clientX, y: e.clientY, duration: 0.5, ease: 'power3.out' });
    });
  }

  /* ---- cursor glow (new): eased-follow via rAF rather than GSAP,
     since it needs to run indefinitely and cheaply, not as a
     one-shot tween per mousemove event ---- */
  if (!CONFIG.tiers[QualityManager.tierName]?.cursorGlow) return;

  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  glow.style.setProperty('--cursor-glow-size', `${CONFIG.cursor.glowSize}px`);
  document.body.appendChild(glow);

  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const pos = { x: target.x, y: target.y };
  const ease = CONFIG.cursor.glowFollowEase;

  window.addEventListener('mousemove', (e) => {
    target.x = e.clientX; target.y = e.clientY;
    glow.classList.add('active');
  });

  // brighten over interactive elements
  $$('a, button, [data-magnetic]').forEach((el) => {
    el.addEventListener('mouseenter', () => glow.classList.add('hot'));
    el.addEventListener('mouseleave', () => glow.classList.remove('hot'));
  });

  (function follow() {
    pos.x = lerp(pos.x, target.x, ease);
    pos.y = lerp(pos.y, target.y, ease);
    glow.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%,-50%)`;
    requestAnimationFrame(follow);
  })();
}
