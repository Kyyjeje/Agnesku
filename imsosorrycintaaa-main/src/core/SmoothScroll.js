/* ============================================================
   SmoothScroll — the one place that owns the Lenis instance and
   its GSAP ScrollTrigger wiring. NavigationEngine needs to stop()
   it while the full-screen index is open; ScrollEngine's reveals
   run on top of it; PageChrome's anchor links call scrollTo() on
   it. All three used to each assume a global `lenis` existed —
   here it's one explicit shared instance instead.
============================================================ */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export const lenis = new Lenis({ duration: 1.15, smoothTouch: false, touchMultiplier: 1.4 });
lenis.on('scroll', () => ScrollTrigger.update());
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

// released once the intro finishes (see engines/SceneEngine.js)
lenis.stop();

export { gsap, ScrollTrigger };
