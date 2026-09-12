/* ============================================================
   INTRO ENGINE — introTypography.js
   The name reveal — the emotional peak of the intro sequence.

   Each letter of her name blooms independently:
     1. Measures the exact screen position of the letter span
     2. Triggers a glow burst on the canvas at that position
     3. Animates the letter from [blur + scale-down + low opacity]
        to [sharp + full size + full opacity], staggered

   Eyebrow and subtitle use simpler single-element fades.
   All GSAP animation is fire-and-forget; no cleanup needed.
============================================================ */
'use strict';

const IntroTypography = (() => {

  let letters      = [];  // DOM spans for each letter of the name
  let canvas       = null;
  let ctx          = null;
  let DPR          = 1;

  /* ── Prepare DOM ─────────────────────────────────────────── */
  function init() {
    canvas = document.getElementById('ie-canvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
      DPR = Math.min(window.devicePixelRatio || 1, 2);
    }

    const nameEl  = document.getElementById('ie-name');
    if (!nameEl) return;

    // Build letter spans from config so text never drifts from config
    const nameStr = INTRO_CFG.typography.name;
    nameEl.innerHTML = '';
    letters = [];
    nameStr.split('').forEach(ch => {
      const span       = document.createElement('span');
      span.className   = 'ie-letter';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      // Initial hidden state — GSAP will animate to visible
      span.style.opacity    = '0';
      span.style.transform  = 'translateY(16px) scale(0.88)';
      span.style.filter     = 'blur(10px)';
      span.style.display    = 'inline-block';
      nameEl.appendChild(span);
      letters.push(span);
    });
  }

  /* ── Canvas glow burst at letter position ─────────────────── */
  function burstAt(domEl) {
    if (!ctx || !domEl) return;
    const rect = domEl.getBoundingClientRect();
    const x    = rect.left + rect.width  / 2;
    const y    = rect.top  + rect.height / 2;
    const R    = INTRO_CFG.typography.letterBloomRadius;

    // Soft radial glow expanding from letter centre
    const gr = ctx.createRadialGradient(x, y, 0, x, y, R * 2);
    gr.addColorStop(0,   'rgba(255,240,248,0.7)');
    gr.addColorStop(0.4, 'rgba(232,143,163,0.3)');
    gr.addColorStop(1,   'rgba(232,143,163,0)');

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle   = gr;
    ctx.beginPath();
    ctx.arc(x, y, R * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Fade the burst out using GSAP-like approach via a tweened state
    const burst = { a: 1.0 };
    gsap.to(burst, {
      a: 0, duration: 0.55, ease: 'power2.out',
      onUpdate: () => {
        // Small overdraw — only the burst circle, not the whole canvas
        ctx.save();
        ctx.globalAlpha = burst.a * 0.4;
        ctx.fillStyle   = gr;
        ctx.beginPath();
        ctx.arc(x, y, R * 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });
  }

  /* ── Reveal methods (called from introTimeline) ──────────── */

  function revealEyebrow() {
    const el = document.getElementById('ie-eyebrow');
    if (!el) return;
    gsap.fromTo(el,
      { opacity: 0, y: 12, filter: 'blur(6px)' },
      { opacity: 1, y: 0,  filter: 'blur(0px)', duration: 1.2, ease: 'power2.out' }
    );
  }

  function revealName() {
    if (!letters.length) return;
    const stagger = INTRO_CFG.typography.letterStagger;
    letters.forEach((span, i) => {
      gsap.to(span, {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.85,
        delay: i * stagger,
        ease: 'power3.out',
        onStart: () => burstAt(span),
      });
    });
  }

  function revealSub() {
    const el = document.getElementById('ie-sub');
    if (!el) return;
    gsap.fromTo(el,
      { opacity: 0, y: 8, filter: 'blur(4px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.0, ease: 'power2.out' }
    );
  }

  /* ── Dissolve (called from introTransition before overlay fades) */
  function dissolve() {
    const stage = document.getElementById('ie-stage');
    if (stage) {
      gsap.to(stage, {
        opacity: 0,
        filter:  'blur(10px)',
        y:       -14,
        duration: 0.85,
        ease:    'power2.in',
      });
    }
  }

  return { init, revealEyebrow, revealName, revealSub, dissolve };

})();
