/* ============================================================
   INTRO ENGINE — introParticles.js
   The light-mote system. Particles begin as a single genesis
   point, fracture outward, lock into elliptical orbits at
   varied radii and speeds, then drift outward on dissolve.

   Three "species" of mote for visual variety:
     • core motes  — tight inner orbits, brighter
     • orbit motes — mid-range, the bulk
     • drift motes — outer, slow, almost static
============================================================ */
'use strict';

const IntroParticles = (() => {

  let pool = [];
  let CX = 0, CY = 0;

  /* ── Mote class ─────────────────────────────────────────── */
  class Mote {
    constructor(tier) {
      this.reset(tier);
    }
    reset(tier) {
      const cfg = INTRO_CFG.particles;
      // orbit parameters — elliptical, not circular, for a more
      // natural feel (planets orbit ellipses; eyes read it as real)
      this.r        = rand(cfg.orbitRadiusMin, cfg.orbitRadiusMax);
      this.rX       = this.r * rand(0.7, 1.0);   // semi-major
      this.rY       = this.r * rand(0.45, 0.75); // semi-minor
      this.angle    = Math.random() * Math.PI * 2;
      this.speed    = rand(cfg.orbitSpeedMin, cfg.orbitSpeedMax);
      this.speed   *= Math.random() > 0.5 ? 1 : -1; // CCW or CW
      this.tilt     = Math.random() * Math.PI * 2;   // orbit plane rotation
      this.size     = rand(cfg.sizeMin, cfg.sizeMax);
      this.phase    = Math.random() * Math.PI * 2;   // twinkle offset
      this.twinkle  = rand(0.0008, 0.0024);
      // choose a subtle colour from the three mote tones
      const palette = [INTRO_CFG.colors.moteA, INTRO_CFG.colors.moteB, INTRO_CFG.colors.moteC];
      this.color    = palette[Math.floor(Math.random() * palette.length)];
      // trail: store last N positions for the luminous smear
      this.trail    = [];
      this.maxTrail = Math.round(this.r * INTRO_CFG.particles.trailLength * 0.22);
      // category affects visual treatment
      this.category = this.r < 80 ? 'core' : this.r < 140 ? 'orbit' : 'drift';
    }

    // Current position on the tilted ellipse
    pos(now) {
      const a = this.angle + now * this.speed;
      const dx = Math.cos(a) * this.rX;
      const dy = Math.sin(a) * this.rY;
      // rotate the ellipse plane by tilt
      const x = CX + dx * Math.cos(this.tilt) - dy * Math.sin(this.tilt);
      const y = CY + dx * Math.sin(this.tilt) + dy * Math.cos(this.tilt);
      return { x, y, a };
    }

    draw(ctx, now, globalAlpha) {
      if (globalAlpha <= 0) return;

      const gather  = INTRO_STATE.particleGather;
      const orbit   = INTRO_STATE.particleOrbit;
      const expand  = INTRO_STATE.particleExpand;

      // During gather: pull toward center
      // During orbit:  sit on ellipse
      // During expand: drift outward
      const { x: ex, y: ey } = this.pos(now);
      const startX = CX + (ex - CX) * (1 - gather);
      const startY = CY + (ey - CY) * (1 - gather);
      // orbit snaps in as orbit state goes to 1
      const ox = CX + (ex - CX) * orbit;
      const oy = CY + (ey - CY) * orbit;
      // expand adds outward push
      const expandFactor = 1 + expand * 1.8;
      const px = CX + (ox - CX) * expandFactor;
      const py = CY + (oy - CY) * expandFactor;

      const lx = CX + (startX - CX) * orbit + (px - ox) * orbit;
      const ly = CY + (startY - CY) * orbit + (py - oy) * orbit;

      // blend genesis approach and orbit
      const bx = lx * (1 - orbit) + px * orbit;
      const by = ly * (1 - orbit) + py * orbit;

      // Twinkle — sinusoidal size variation
      const tw  = 0.62 + Math.sin(now * this.twinkle + this.phase) * 0.38;
      const sz  = this.size * tw;

      // Opacity: core motes brighter; outer ones subtler
      const baseAlpha = this.category === 'core'  ? 0.82
                      : this.category === 'orbit' ? 0.55
                      : 0.28;
      const alpha = baseAlpha * globalAlpha * orbit;

      if (alpha <= 0.01) return;

      // Draw trail (luminous smear behind the mote)
      if (orbit > 0.2 && this.maxTrail > 1) {
        this.trail.push({ x: bx, y: by });
        if (this.trail.length > this.maxTrail) this.trail.shift();
        for (let i = 1; i < this.trail.length; i++) {
          const ta = (i / this.trail.length) * alpha * 0.35;
          ctx.globalAlpha = ta;
          ctx.fillStyle   = this.color;
          const ts = sz * (i / this.trail.length) * 0.6;
          ctx.beginPath();
          ctx.arc(this.trail[i].x, this.trail[i].y, ts, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Core glow pass
      ctx.save();
      ctx.globalAlpha = alpha * 0.4;
      const gr = ctx.createRadialGradient(bx, by, 0, bx, by, sz * 3.5);
      gr.addColorStop(0, this.color);
      gr.addColorStop(1, 'rgba(255,235,245,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(bx, by, sz * 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Crisp centre dot
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = this.color;
      ctx.beginPath();
      ctx.arc(bx, by, sz, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ── Pool management ─────────────────────────────────────── */
  function buildPool(tier) {
    const n = INTRO_CFG.particles.counts[tier] || 0;
    CX = window.innerWidth  / 2;
    CY = window.innerHeight / 2;
    pool = [];
    for (let i = 0; i < n; i++) pool.push(new Mote(tier));
  }

  function onResize() {
    CX = window.innerWidth  / 2;
    CY = window.innerHeight / 2;
  }

  /* ── Public draw ─────────────────────────────────────────── */
  function draw(ctx, cxFn, cyFn, now) {
    CX = cxFn();
    CY = cyFn();
    const ga = INTRO_STATE.particleAlpha;
    if (ga <= 0) return;
    pool.forEach(m => m.draw(ctx, now, ga));
    ctx.globalAlpha = 1;
  }

  return { buildPool, onResize, draw };

})();
