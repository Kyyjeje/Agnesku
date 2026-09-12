/* ============================================================
   INTRO ENGINE — introCamera.js
   Simulates a slow cinematic camera move by applying a CSS
   transform to the scene canvas. No actual 3D or WebGL —
   just a scale + translate that feels like a lens pull-back
   as the world opens up around the viewer.

   A second slow drift path (a smooth Lissajous curve) keeps
   things alive while text is reading, without ever feeling
   mechanical or looped.

   Exposes:
     init()   — cache the canvas reference
     update() — call every frame with current timestamp
     stop()   — reset transform on dissolve
============================================================ */
'use strict';

const IntroCamera = (() => {

  let canvas    = null;
  let startTime = 0;
  let running   = false;

  function init() {
    canvas    = document.getElementById('ie-canvas');
    startTime = performance.now();
    running   = true;
  }

  function update(now) {
    if (!running || !canvas) return;

    const cfg = INTRO_CFG.camera;
    const t   = (now - startTime) / 1000; // seconds elapsed

    // Scale: pull from startScale toward endScale, capped at 1.0
    const scale = INTRO_STATE.camScale;

    // Drift: slow sinusoidal path (Lissajous-like)
    const driftPeriod = cfg.driftPeriod;
    const dx = Math.sin((t / driftPeriod) * Math.PI * 2)       * cfg.driftX;
    const dy = Math.sin((t / driftPeriod) * Math.PI * 2 * 0.7) * cfg.driftY;

    canvas.style.transform       = `scale(${scale}) translate(${dx}px, ${dy}px)`;
    canvas.style.transformOrigin = '50% 50%';
    canvas.style.willChange      = 'transform';
  }

  function stop() {
    running = false;
    if (!canvas) return;
    // Smoothly reset transform rather than snapping (GSAP handles fade, we just clear)
    canvas.style.transform  = '';
    canvas.style.willChange = 'auto';
  }

  return { init, update, stop };

})();
