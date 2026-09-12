/* ============================================================
   APP — page-level bootstrap. Everything here is a cross-cutting
   concern that doesn't belong to one feature module: smooth
   scrolling, in-page anchor navigation, and the finale button.

   Loads early (right after config/utils/petals-engine) so `lenis`
   exists before navigation.js runs; references to things defined
   in later files (closeIndex, engine.burst) are safe because they
   only run inside event-listener callbacks, which fire long after
   every module has finished loading.

   RESILIENCE NOTE: gsap, ScrollTrigger and Lenis all load from a
   third-party CDN (see index.html). On mobile in particular that
   request can fail or stall — flaky data connections, in-app
   browsers, ad/tracker blockers on Safari and Android all block or
   delay third-party scripts far more often than on a desktop
   connection. If that happens, `gsap`/`Lenis` simply won't exist
   yet when this file runs. Without a guard, that throws here,
   which (since `lenis` never gets defined) cascades into every
   later file that touches it — most critically intro.js, which
   calls `lenis.start()` to release the scroll lock it starts with.
   A missing library must never be able to leave the site scroll-
   locked or otherwise stuck, so every use of an external library
   in this file is guarded, and `lenis` always ends up bound to
   *something* callable — either the real thing or a no-op shim.
============================================================ */
'use strict';

const libsReady = typeof gsap !== 'undefined' && typeof Lenis !== 'undefined';

if (libsReady){
  try {
    if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
  } catch (err){
    console.warn('[app] ScrollTrigger failed to register — scroll-linked effects will be skipped.', err);
  }
}

// A tiny shim matching the surface area this project actually calls
// on `lenis` (start/stop/on/scrollTo/raf), so every other file can
// keep calling `lenis.start()` etc. unconditionally instead of every
// call site needing its own existence check. When Lenis genuinely
// isn't available, scrolling simply falls back to the browser's own
// native scroll — never blocked, never hijacked.
function createNoopLenis(){
  return {
    start(){}, stop(){}, on(){}, raf(){},
    scrollTo(target){
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  };
}

let lenis;
if (libsReady){
  try {
    lenis = new Lenis({ duration: 1.15, smoothTouch:false, touchMultiplier:1.4 });
    lenis.on('scroll', () => { if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update(); });
    gsap.ticker.add((t)=> lenis.raf(t*1000));
    gsap.ticker.lagSmoothing(0);
  } catch (err){
    console.warn('[app] Lenis failed to initialize — falling back to native scroll.', err);
    lenis = createNoopLenis();
  }
} else {
  console.warn('[app] gsap/Lenis unavailable (CDN blocked or slow) — running without smooth-scroll/animation libraries. The site remains fully usable via native scroll.');
  lenis = createNoopLenis();
}
window.lenis = lenis; // intro.js, navigation.js and scroll-reveal.js all read this
lenis.stop(); // released once the intro finishes (see intro.js) — or immediately by
              // intro.js's own fail-safe if the intro can't run at all

document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const targetSel = a.getAttribute('href');
    if (!targetSel || targetSel === '#') return;
    e.preventDefault();
    const el = document.querySelector(targetSel);
    if (el) lenis.scrollTo(el, {offset:0, duration:1.3});
    if (typeof closeIndex === 'function') closeIndex();
  });
});

/* ---- finale confetti — also seeds a burst into the petal engine ---- */
const confettiBtn = document.getElementById('confettiBtn');
if (confettiBtn){
  confettiBtn.addEventListener('click', (e)=>{
    try {
      if (typeof confetti === 'function'){
        const colors = [CONFIG.colors.rose, CONFIG.colors.roseSoft, CONFIG.colors.gold, CONFIG.colors.roseBright];
        confetti({ particleCount: 120, spread: 100, startVelocity: 36, gravity:.7, scalar:1.1, colors, origin:{y:.7} });
        confetti({ particleCount: 50, spread: 140, startVelocity: 20, gravity:.5, scalar:.8, colors, origin:{y:.6}, angle:60 });
        confetti({ particleCount: 50, spread: 140, startVelocity: 20, gravity:.5, scalar:.8, colors, origin:{y:.6}, angle:120 });
      }
      if (typeof engine !== 'undefined' && engine.burst){
        const r = e.currentTarget.getBoundingClientRect();
        engine.burst(r.left+r.width/2, r.top, 22, {spread:Math.PI*1.4, minSpeed:2, maxSpeed:6, gravity:0.1});
      }
    } catch (err){
      console.warn('[app] finale celebration effect failed — non-fatal.', err);
    }
  });
}
