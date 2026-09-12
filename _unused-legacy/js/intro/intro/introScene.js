/* ============================================================
   INTRO ENGINE — introScene.js
   Canvas setup (DPR-aware), the master requestAnimationFrame
   loop, and scene composition. Each sub-system exposes a draw()
   call; this module calls them in the correct painter's-algorithm
   order every frame.

   Design intent: nothing here has state. It only coordinates.
============================================================ */
'use strict';

const IntroScene = (() => {

  let canvas, ctx;
  let W, H, DPR;
  let rafId = null;
  let running = false;

  /* ── Setup ─────────────────────────────────────────────── */
  function init() {
    canvas = document.getElementById('ie-canvas');
    ctx    = canvas.getContext('2d', { alpha: true });
    resize();
    window.addEventListener('resize', resize, { passive: true });
  }

  function resize() {
    DPR            = Math.min(window.devicePixelRatio || 1, 2);
    W              = canvas.width  = Math.round(window.innerWidth  * DPR);
    H              = canvas.height = Math.round(window.innerHeight * DPR);
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // Notify sub-systems that need to recalculate layout on resize
    if (typeof IntroParticles !== 'undefined') IntroParticles.onResize();
    if (typeof IntroFlowers   !== 'undefined') IntroFlowers.onResize();
  }

  /* ── Rendering ─────────────────────────────────────────── */
  // cx/cy in CSS pixels (sub-systems use innerWidth/innerHeight, not W/H)
  function cx() { return window.innerWidth  / 2; }
  function cy() { return window.innerHeight / 2; }

  function drawBackground(now) {
    if (INTRO_STATE.bgAlpha <= 0) return;
    // Radial dream-gradient: a deep plum dusk, not pure black
    // Two overlapping centres — one warm rose, one cooler plum —
    // that breathe very slowly against each other.
    const pulse = Math.sin(now * 0.00038) * 0.04;
    const gr1 = ctx.createRadialGradient(
      cx() * 0.7, cy() * 0.5, 0,
      cx() * 0.7, cy() * 0.5, Math.min(W, H) * 0.9
    );
    gr1.addColorStop(0,   `rgba(60, 22, 38, ${(0.82 + pulse) * INTRO_STATE.bgAlpha})`);
    gr1.addColorStop(0.5, `rgba(38, 14, 26, ${0.95 * INTRO_STATE.bgAlpha})`);
    gr1.addColorStop(1,   `rgba(23,  9, 19, ${INTRO_STATE.bgAlpha})`);

    // Fill entire canvas with base deep tone first
    ctx.fillStyle = `rgba(23, 9, 19, ${INTRO_STATE.bgAlpha})`;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Overlay the warm-rose gradient
    ctx.fillStyle = gr1;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function drawFrame(now) {
    if (typeof IntroCamera !== "undefined") IntroCamera.update(now);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    drawBackground(now);
    IntroLighting.drawFog(ctx, cx, cy, now);
    IntroFlowers.draw(ctx, now);
    IntroParticles.draw(ctx, cx, cy, now);
    IntroLighting.drawBloom(ctx, cx, cy, now);
    IntroLighting.drawGenesis(ctx, cx, cy, now);
    IntroLighting.drawFlash(ctx, now);
  }

  /* ── RAF loop ───────────────────────────────────────────── */
  function start() {
    if (running) return;
    running = true;
    (function loop(now) {
      if (!running) return;
      drawFrame(now || 0);
      rafId = requestAnimationFrame(loop);
    })();
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener('resize', resize);
    // Blank the canvas so nothing lingers
    if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  return { init, start, stop, cx, cy };

})();
