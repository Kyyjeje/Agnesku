/* ============================================================
   ScrollEngine — everything driven by scroll position: the
   progress hairline, the memory counter, section fade-ins (via
   MotionEngine presets), the letter's slower-paced reveal, ambient
   petal "mood" per section, active-link syncing, and gallery
   parallax.

   Talks to ParticleEngine only through the event bus ('petals:mood')
   instead of importing it directly — ScrollEngine doesn't need to
   know a particle engine exists at all, just that something might
   be listening for a mood change.
============================================================ */

import { gsap, ScrollTrigger } from '../core/SmoothScroll.js';
import { bus } from '../core/EventBus.js';
import { fadeUp, staggerIn } from './MotionEngine.js';
import { gardenIndexLinks } from './NavigationEngine.js';
import { $, $$ } from '../utils/dom.js';

export function initScrollEngine() {
  // whole-page scroll progress hairline under the nav
  const progressBar = document.getElementById('scrollProgress');
  if (progressBar) {
    gsap.to(progressBar, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
    });
  }

  // memory counter — counts up to the actual number of gallery
  // photos in the DOM, never hard-coded
  const memoryCountEl = document.getElementById('memoryCount');
  if (memoryCountEl) {
    const total = $$('.press-card').length;
    ScrollTrigger.create({
      trigger: '#gallery', start: 'top 75%', once: true,
      onEnter: () => {
        const counter = { n: 0 };
        gsap.to(counter, {
          n: total, duration: 1.1, ease: 'power1.out',
          onUpdate: () => (memoryCountEl.textContent = Math.round(counter.n)),
        });
      },
    });
  }

  fadeUp('.section-head, .note, .player, .dial-row');

  // The letter is the emotional peak — its own slower pace.
  staggerIn('.letter-drop, .letter p, .letter-sign', { trigger: '.letter', start: 'top 80%', stagger: 0.35, duration: 1.1, y: 26 });

  ScrollTrigger.create({
    trigger: '#message', start: 'top 60%', end: 'bottom 40%',
    onEnter: () => bus.emit('petals:mood', 0.45), onEnterBack: () => bus.emit('petals:mood', 0.45),
    onLeave: () => bus.emit('petals:mood', 1), onLeaveBack: () => bus.emit('petals:mood', 1),
  });
  ScrollTrigger.create({
    trigger: '#finale', start: 'top 65%',
    onEnter: () => bus.emit('petals:mood', 1.7), onLeaveBack: () => bus.emit('petals:mood', 1),
  });

  // keep the full index, the always-visible nav bar, and the nav's
  // live chapter indicator all in sync with scroll position
  const sectionOrder = ['#hero', '#gallery', '#reasons', '#message', '#playlist', '#countdown', '#finale'];
  const navChapterNum = document.getElementById('navChapterNum');
  const navChapterTotal = document.getElementById('navChapterTotal');
  const navLinks = $$('#navLinks a');
  if (navChapterTotal) navChapterTotal.textContent = String(sectionOrder.length).padStart(2, '0');

  function setActiveSection(id) {
    gardenIndexLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === id));
    navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === id));
    if (navChapterNum) {
      const idx = sectionOrder.indexOf(id);
      if (idx > -1) navChapterNum.textContent = String(idx + 1).padStart(2, '0');
    }
  }
  sectionOrder.forEach((id) => {
    ScrollTrigger.create({
      trigger: id, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) setActiveSection(id); },
    });
  });
  setActiveSection('#hero');

  // gallery: reveal, depth parallax, hover scale
  gsap.utils.toArray('.press-card').forEach((card, i) => {
    gsap.fromTo(card, { opacity: 0, y: 50 }, {
      opacity: 1, y: 0, duration: 0.8, delay: i * 0.05, ease: 'power3.out',
      scrollTrigger: { trigger: card, start: 'top 92%' },
    });
  });
  ScrollTrigger.matchMedia({
    '(min-width: 701px)': () => {
      $$('.press-card').forEach((card) => {
        const depth = parseFloat(card.dataset.depth || 0.5);
        gsap.to(card, {
          y: -120 * depth, ease: 'none',
          scrollTrigger: { trigger: '#pressField', start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
    },
  });
  $$('.press-card').forEach((card) => {
    card.addEventListener('mouseenter', () => gsap.to(card, { scale: 1.04, duration: 0.5, ease: 'power3.out', zIndex: 5 }));
    card.addEventListener('mouseleave', () => gsap.to(card, { scale: 1, duration: 0.5, ease: 'power3.out', zIndex: 1 }));
  });
}
