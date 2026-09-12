/* ============================================================
   MotionEngine — a small library of reveal presets. Every place
   in the old scroll-reveal.js that called `gsap.fromTo(el, {...},
   {...})` with slightly different numbers is now one named preset
   here, called from ScrollEngine and the new GalleryLightbox. Not
   every animation preset from the brief's "motion library" list is
   here — only the ones this page actually uses (fadeUp, staggerIn,
   blurReveal, scaleIn) — an unused "elasticMotion" preset would
   just be dead code with a name.
============================================================ */

import { gsap, ScrollTrigger } from '../core/SmoothScroll.js';

/** Fade + rise into place as it enters the viewport. Used for
 *  section heads, notes, the music player, countdown row. */
export function fadeUp(elements, { start = 'top 88%', duration = 0.9 } = {}) {
  gsap.utils.toArray(elements).forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 40 }, {
      opacity: 1, y: 0, duration, ease: 'power3.out',
      scrollTrigger: { trigger: el, start },
    });
  });
}

/** Staggered reveal for a group that should read in order — the
 *  letter's paragraphs, gallery cards. */
export function staggerIn(elements, { trigger, start = 'top 85%', stagger = 0.12, duration = 0.9, y = 30 } = {}) {
  const els = gsap.utils.toArray(elements);
  if (!els.length) return;
  gsap.fromTo(els, { opacity: 0, y }, {
    opacity: 1, y: 0, duration, ease: 'power3.out', stagger,
    scrollTrigger: { trigger: trigger || els[0], start },
  });
}

/** Glass-blur reveal: opacity + blur + slight scale settle. Used
 *  by the new gallery lightbox when a photo opens, and available
 *  for any future "premium" reveal moment. */
export function blurReveal(el, { duration = 0.42, fromScale = 1.04, blurPx = 14 } = {}) {
  return gsap.fromTo(
    el,
    { opacity: 0, scale: fromScale, filter: `blur(${blurPx}px)` },
    { opacity: 1, scale: 1, filter: 'blur(0px)', duration, ease: 'power2.out' },
  );
}

/** Reverse of blurReveal, for closing. Returns the tween so the
 *  caller can chain a DOM-removal onComplete. */
export function blurDismiss(el, { duration = 0.3, toScale = 0.97, blurPx = 10, onComplete } = {}) {
  return gsap.to(el, { opacity: 0, scale: toScale, filter: `blur(${blurPx}px)`, duration, ease: 'power2.in', onComplete });
}

export { ScrollTrigger };
