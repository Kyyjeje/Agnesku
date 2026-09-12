/* ============================================================
   INTRO ENGINE — introFlowers.js
   Three depth layers of drifting flower emoji, rendered with
   the same sprite cache the page's petals-engine uses, so the
   transition into the page's own petal field looks continuous.

   Layer 0 (far):  small, faint, slow — atmosphere
   Layer 1 (mid):  normal — the main bloom
   Layer 2 (near): large, vivid, slightly faster — foreground accent
============================================================ */
'use strict';

const IntroFlowers = (() => {

  let layers = []; // array of arrays of flower objects
  let W = window.innerWidth, H = window.innerHeight;

  /* ── Flower object ──────────────────────────────────────── */
  function makeFlower(layerCfg) {
    const cfg  = INTRO_CFG.flowers;
    const baseSz = rand(cfg.sizeMin, cfg.sizeMax);
    return {
      x:         rand(-0.08, 1.08) * W,
      y:         H + rand(10, 80),    // start just below screen
      vx:        (Math.random() - 0.5) * 0.22,
      vy:        -rand(cfg.speedMin, cfg.speedMax) * H * layerCfg.speedMul,
      size:      baseSz * layerCfg.sizeMul,
      rot:       Math.random() * Math.PI * 2,
      spin:      (Math.random() - 0.5) * cfg.spinMax,
      bobPhase:  Math.random() * Math.PI * 2,
      bobSpeed:  rand(cfg.wobbleSpd * 0.6, cfg.wobbleSpd * 1.4),
      bobAmt:    rand(cfg.wobbleAmt * 0.5, cfg.wobbleAmt * 1.5),
      opRange:   layerCfg.opacityRange,
      // pick a sprite from the shared spriteCache (petals-engine.js)
      sprite:    spriteCache.get(weightedEmoji[(Math.random() * weightedEmoji.length) | 0]),
      z:         layerCfg.z,
      born:      performance.now(),
    };
  }

  /* ── Build layers ───────────────────────────────────────── */
  function buildLayers(tier) {
    W = window.innerWidth;
    H = window.innerHeight;
    const total = INTRO_CFG.flowers.counts[tier] || 0;
    const layerCfgs = INTRO_CFG.flowers.layers;
    // Distribute flowers across layers weighted by depth visibility
    const weights = [0.25, 0.45, 0.30];
    layers = layerCfgs.map((lc, i) => {
      const n = Math.max(1, Math.round(total * weights[i]));
      return Array.from({ length: n }, () => makeFlower(lc));
    });
    // Stagger initial Y positions so not all appear at once
    layers.forEach(layer => {
      layer.forEach((f, j) => {
        f.y = H + rand(20, H * 0.6) + j * 28;
      });
    });
  }

  function onResize() {
    W = window.innerWidth;
    H = window.innerHeight;
    layers.forEach(layer => {
      layer.forEach(f => {
        if (f.y > H + 60) f.y = H + rand(20, 80);
      });
    });
  }

  /* ── Draw ──────────────────────────────────────────────── */
  function drawFlower(ctx, f, now, masterAlpha) {
    if (!f.sprite) return;
    const t   = (now - f.born) * 0.001; // seconds alive
    const bob = Math.sin(now * f.bobSpeed + f.bobPhase) * f.bobAmt;
    const x   = f.x + bob;
    const y   = f.y; // position updated in update()

    // Depth blur: far flowers slightly blurred via canvas shadow
    const blur = (1 - f.z) * 2.5;

    // Opacity: fade in from 0 as the flower first enters frame
    // then hold within the configured range
    const entryFade = clamp((H - y) / (f.size * 3), 0, 1);
    const [opMin, opMax] = f.opRange;
    const baseOp = opMin + (opMax - opMin) * f.z;
    const alpha  = baseOp * masterAlpha * entryFade;

    if (alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.translate(x, y);
    ctx.rotate(f.rot);
    if (blur > 0.5) {
      ctx.filter = `blur(${blur.toFixed(1)}px)`;
    }
    ctx.drawImage(f.sprite, -f.size / 2, -f.size / 2, f.size, f.size);
    ctx.restore();
  }

  function update(dt) {
    layers.forEach(layer => {
      layer.forEach(f => {
        f.y   += f.vy * dt;
        f.x   += f.vx;
        f.rot += f.spin;
        // Recycle: when flower exits top, reset below screen
        if (f.y < -f.size * 2) {
          f.x   = rand(-0.08, 1.08) * W;
          f.y   = H + rand(20, 60);
          f.born = performance.now();
        }
      });
    });
  }

  let lastNow = 0;
  function draw(ctx, now) {
    const dt  = lastNow ? Math.min((now - lastNow) * 0.001, 0.05) : 0.016;
    lastNow   = now;
    const master = INTRO_STATE.flowerAlpha;
    if (master <= 0) return;
    update(dt);
    // Paint back-to-front: layer 0 (far) first, layer 2 (near) last
    layers.forEach(layer => {
      layer.forEach(f => drawFlower(ctx, f, now, master));
    });
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }

  return { buildLayers, onResize, draw };

})();
