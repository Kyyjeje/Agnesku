/* ============================================================
   INTRO ENGINE — introLighting.js
   Four lighting passes drawn to the canvas each frame:
     1. drawGenesis  — the birth point, a single glowing dot
     2. drawFog      — soft volumetric haze filling the scene
     3. drawBloom    — the central radial bloom expanding outward
     4. drawFlash    — a brief lens-exposure flash at the name reveal

   All values read from INTRO_STATE — this module draws, not decides.
============================================================ */
'use strict';

const IntroLighting = (() => {

  /* ── 1. Genesis — the first point of light ─────────────── */
  function drawGenesis(ctx, cx, cy, now) {
    const s = INTRO_STATE.genesisSize;
    const g = INTRO_STATE.genesisGlow;
    if (s <= 0 && g <= 0) return;

    const x = cx(), y = cy();

    // Outer halo
    if (g > 0) {
      const haloR = 90 * g;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, haloR);
      gr.addColorStop(0,   `rgba(255,240,248,${0.55 * g})`);
      gr.addColorStop(0.4, `rgba(255,200,220,${0.22 * g})`);
      gr.addColorStop(1,   'rgba(255,200,220,0)');
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle   = gr;
      ctx.beginPath();
      ctx.arc(x, y, haloR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Star starburst — 4 tiny rays crossing at genesis point
    if (s > 0) {
      const len = 14 * s;
      ctx.save();
      ctx.globalAlpha = 0.7 * s;
      ctx.strokeStyle = '#fff4f8';
      ctx.lineWidth   = 0.8;
      ctx.lineCap     = 'round';
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();

      // Core dot
      ctx.save();
      ctx.globalAlpha = s;
      ctx.fillStyle   = '#ffffff';
      ctx.shadowColor = '#ff9fc0';
      ctx.shadowBlur  = 18 * s;
      ctx.beginPath();
      ctx.arc(x, y, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ── 2. Fog — soft volumetric atmosphere ────────────────── */
  function drawFog(ctx, cx, cy, now) {
    const a = INTRO_STATE.fogAlpha;
    if (a <= 0) return;

    const x = cx(), y = cy();
    // Three overlapping fog pockets at slightly different positions
    // for a layered, volumetric feel
    const pockets = [
      { dx: 0,            dy: 0,             r: 0.65, alpha: 0.14 },
      { dx: -0.12,        dy:  0.08,         r: 0.48, alpha: 0.09 },
      { dx:  0.10,        dy: -0.10,         r: 0.40, alpha: 0.07 },
    ];
    const base = Math.min(window.innerWidth, window.innerHeight);
    pockets.forEach(p => {
      const fogR = base * p.r;
      const gr   = ctx.createRadialGradient(
        x + p.dx * base, y + p.dy * base, 0,
        x + p.dx * base, y + p.dy * base, fogR
      );
      gr.addColorStop(0,   `rgba(220,160,180,${p.alpha * a})`);
      gr.addColorStop(0.6, `rgba(180,100,130,${p.alpha * 0.4 * a})`);
      gr.addColorStop(1,   'rgba(160,80,110,0)');
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle   = gr;
      ctx.beginPath();
      ctx.arc(x + p.dx * base, y + p.dy * base, fogR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /* ── 3. Bloom — the expanding central glow ──────────────── */
  function drawBloom(ctx, cx, cy, now) {
    const intensity = INTRO_STATE.bloomIntensity;
    const radiusFrac = INTRO_STATE.bloomRadius;
    if (intensity <= 0) return;

    const x   = cx(), y = cy();
    const cfg = INTRO_CFG.lighting;

    // Breathing: tiny sinusoidal pulse so it never feels static
    const breath = 1 + Math.sin(now * cfg.bloomPulseSpeed) * cfg.bloomPulseAmt;
    const R      = (cfg.bloomRadiusMin + (cfg.bloomRadius - cfg.bloomRadiusMin) * radiusFrac)
                 * breath * intensity;

    // Outer aura (very soft, wide)
    const auraR = R * 2.2;
    const aura  = ctx.createRadialGradient(x, y, 0, x, y, auraR);
    aura.addColorStop(0,   `rgba(255,160,192,${0.18 * intensity})`);
    aura.addColorStop(0.45,`rgba(232,143,163,${0.10 * intensity})`);
    aura.addColorStop(1,   'rgba(232,143,163,0)');
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle   = aura;
    ctx.beginPath();
    ctx.arc(x, y, auraR, 0, Math.PI * 2);
    ctx.fill();

    // Inner bloom (sharper, brighter)
    const bloom = ctx.createRadialGradient(x, y, 0, x, y, R);
    bloom.addColorStop(0,   `rgba(255,230,240,${0.72 * intensity})`);
    bloom.addColorStop(0.25,`rgba(255,180,210,${0.45 * intensity})`);
    bloom.addColorStop(0.7, `rgba(232,143,163,${0.18 * intensity})`);
    bloom.addColorStop(1,   'rgba(232,143,163,0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ── 4. Flash — lens-flash beat at the name reveal ─────── */
  function drawFlash(ctx, now) {
    const f = INTRO_STATE.flashIntensity;
    if (f <= 0.01) return;

    const W = window.innerWidth, H = window.innerHeight;
    const cx = W / 2, cy = H / 2;

    ctx.save();
    // Full-frame bright wash
    ctx.globalAlpha = f * 0.55;
    ctx.fillStyle   = '#fff6fa';
    ctx.fillRect(0, 0, W, H);

    // Horizontal lens streak
    ctx.globalAlpha = f * 0.45;
    const hGrad = ctx.createLinearGradient(0, cy, W, cy);
    hGrad.addColorStop(0,    'rgba(255,246,250,0)');
    hGrad.addColorStop(0.45, 'rgba(255,246,250,0.6)');
    hGrad.addColorStop(0.5,  'rgba(255,255,255,1)');
    hGrad.addColorStop(0.55, 'rgba(255,246,250,0.6)');
    hGrad.addColorStop(1,    'rgba(255,246,250,0)');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, cy - 1.5, W, 3);

    // Vertical lens streak
    const vGrad = ctx.createLinearGradient(cx, 0, cx, H);
    vGrad.addColorStop(0,    'rgba(255,246,250,0)');
    vGrad.addColorStop(0.45, 'rgba(255,246,250,0.3)');
    vGrad.addColorStop(0.5,  'rgba(255,255,255,0.7)');
    vGrad.addColorStop(0.55, 'rgba(255,246,250,0.3)');
    vGrad.addColorStop(1,    'rgba(255,246,250,0)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(cx - 1, 0, 2, H);

    // Two expanding rings (concentric lens circles)
    ctx.globalAlpha = f * 0.30;
    [0.5, 1.0].forEach(mul => {
      const r = 70 * mul * (1 + f * 0.4);
      ctx.strokeStyle = 'rgba(255,230,240,0.8)';
      ctx.lineWidth   = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.restore();
  }

  return { drawGenesis, drawFog, drawBloom, drawFlash };

})();
