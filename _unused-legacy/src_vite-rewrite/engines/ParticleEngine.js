/* ============================================================
   ParticleEngine — a real canvas particle system: physics
   (velocity, gravity, drag, wind), object pooling, three depth
   layers, sprite batching.

   Device-tier detection and the live performance monitor now live
   in QualityManager (core/QualityManager.js) instead of being
   duplicated here — this module only asks "what's my ceiling right
   now" and reacts to `quality:change` when the monitor steps down.
============================================================ */

import { CONFIG } from '../core/ConfigEngine.js';
import { QualityManager } from '../core/QualityManager.js';
import { bus } from '../core/EventBus.js';
import { clamp, rand } from '../utils/math.js';

const SPRITE_SIZE = CONFIG.petals.spriteSize;
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function makeSprite(ch) {
  const s = SPRITE_SIZE * 2;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const cx = c.getContext('2d');
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.font = `${s * 0.7}px ${EMOJI_FONT}`;
  cx.shadowColor = 'rgba(255,190,210,.5)';
  cx.shadowBlur = s * 0.14;
  cx.fillText(ch, s / 2, s / 2 + s * 0.02);
  cx.shadowBlur = 0;
  cx.fillText(ch, s / 2, s / 2 + s * 0.02);
  return c;
}

const spriteCache = new Map(CONFIG.petals.species.map((e) => [e.ch, makeSprite(e.ch)]));
const weightedEmoji = CONFIG.petals.species.flatMap((e) => Array(Math.round(e.w * 4)).fill(e.ch));
export { spriteCache, weightedEmoji };

function makePicker() {
  let last1 = null, last2 = null;
  return () => {
    let ch, tries = 0;
    do { ch = weightedEmoji[(Math.random() * weightedEmoji.length) | 0]; tries++; }
    while ((ch === last1 || ch === last2) && tries < 6);
    last2 = last1; last1 = ch;
    return spriteCache.get(ch);
  };
}

class Petal {
  constructor() { this.active = false; }
  spawn(o) {
    this.active = true;
    this.x = o.x; this.y = o.y;
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.gravity = o.gravity ?? 0.05;
    this.drag = o.drag ?? 0.99;
    this.rot = Math.random() * Math.PI * 2;
    this.vrot = (Math.random() - 0.5) * (o.spin ?? 0.025);
    this.scale = o.scale ?? rand(0.4, 1.1);
    this.sprite = o.sprite;
    this.age = 0;
    this.maxLife = o.maxLife ?? Infinity;
    this.phase = Math.random() * Math.PI * 2;
    this.freq = rand(0.0006, 0.0016);
    this.opacity = o.opacity ?? rand(0.45, 0.9);
    this.recycle = o.recycle !== false;
    this.fadeInMs = o.fadeIn ?? 900;

    const r = Math.random();
    this.behavior = r < 0.10 ? 'riser' : r < 0.20 ? 'circler' : r < 0.28 ? 'pauser' : 'drift';
    this.circlePhase = Math.random() * Math.PI * 2;
    this.circleFreq = rand(0.0015, 0.003);
    this.pausePhase = Math.random() * Math.PI * 2;
    this.pauseFreq = rand(0.0007, 0.0015);
    this.breathes = Math.random() < 0.35;
    this.breathePhase = Math.random() * Math.PI * 2;
    this.breatheFreq = rand(0.0009, 0.0018);
  }
  step(dt, gust, W, H) {
    this.age += dt;
    if (this.age > this.maxLife) { this.active = false; return; }
    const f = dt / 16.7;
    const wind = Math.sin(this.age * this.freq + this.phase) * 0.35 + gust;
    this.vx += wind * 0.02 * dt;
    this.vy += this.gravity * 0.02 * dt;

    let dragMul = 1;
    if (this.behavior === 'riser' && this.age < 750) {
      this.vy -= 0.05 * f;
    } else if (this.behavior === 'circler') {
      this.vx += Math.cos(this.age * this.circleFreq + this.circlePhase) * 0.03 * f;
      this.vy += Math.sin(this.age * this.circleFreq + this.circlePhase) * 0.022 * f;
    } else if (this.behavior === 'pauser') {
      if (Math.sin(this.age * this.pauseFreq + this.pausePhase) > 0.86) dragMul = 0.82;
    }

    this.vx *= Math.pow(this.drag * dragMul, f);
    this.vy *= Math.pow(this.drag * dragMul, f);
    this.x += this.vx * f;
    this.y += this.vy * f;
    this.rot += this.vrot * f;

    if (this.recycle) {
      if (this.y - 60 > H) { this.y = -60; this.x = rand(0, W); this.vy = rand(0.3, 0.9); this.vx = rand(-0.3, 0.3); this.age = 0; }
      if (this.x < -80) this.x = W + 80;
      else if (this.x > W + 80) this.x = -80;
    } else if (this.y > H + 100 || this.x < -100 || this.x > W + 100) {
      this.active = false;
    }
  }
  repel(mx, my, radius, force) {
    const dx = this.x - mx, dy = this.y - my;
    const d2 = dx * dx + dy * dy;
    if (d2 > radius * radius || d2 < 1) return;
    const d = Math.sqrt(d2);
    const f = (1 - d / radius) * force;
    this.vx += (dx / d) * f;
    this.vy += (dy / d) * f;
  }
  draw(ctx) {
    const s = SPRITE_SIZE * 2 * this.scale * 0.5;
    const fadeIn = this.age < this.fadeInMs ? this.age / this.fadeInMs : 1;
    const breathe = this.breathes ? (0.85 + Math.sin(this.age * this.breatheFreq + this.breathePhase) * 0.15) : 1;
    ctx.save();
    ctx.globalAlpha = this.opacity * fadeIn * breathe;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.drawImage(this.sprite, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
}

class Layer {
  constructor(canvas, conf) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.conf = conf;
    this.pool = Array.from({ length: 56 }, () => new Petal());
    this.pickSprite = makePicker();
    this.W = 0; this.H = 0;
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.conf.dpr);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  activeCount() { let n = 0; for (const p of this.pool) if (p.active) n++; return n; }
  ambientSpawn(anywhere) {
    const p = this.pool.find((p) => !p.active);
    if (!p) return;
    p.spawn({
      x: rand(0, this.W),
      y: anywhere ? rand(0, this.H) : -60,
      vx: rand(-0.3, 0.3),
      vy: rand(0.3, 0.9) * this.conf.speed,
      gravity: 0.04 * this.conf.speed,
      drag: 0.992,
      scale: rand(this.conf.scaleMin, this.conf.scaleMax),
      opacity: rand(this.conf.opMin, this.conf.opMax),
      spin: 0.02,
      recycle: true,
      sprite: this.pickSprite(),
      fadeIn: anywhere ? 0 : rand(700, 1300),
    });
  }
  fill(target, anywhere) {
    const n = this.activeCount();
    for (let i = n; i < target; i++) this.ambientSpawn(anywhere);
  }
  burst(x, y, count, opts = {}) {
    let n = 0;
    for (const p of this.pool) {
      if (n >= count) break;
      if (p.active) continue;
      const spread = opts.spread ?? Math.PI * 0.7;
      const angle = -Math.PI / 2 + rand(-spread / 2, spread / 2);
      const speed = rand(opts.minSpeed ?? 3, opts.maxSpeed ?? 8);
      p.spawn({
        x: x + rand(-20, 20), y: y + rand(-10, 10),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        gravity: opts.gravity ?? 0.14, drag: opts.drag ?? 0.985,
        scale: rand(0.5, 1.2), opacity: rand(0.7, 1),
        spin: 0.05, maxLife: opts.maxLife ?? 5200, recycle: false,
        sprite: this.pickSprite(), fadeIn: 0,
      });
      n++;
    }
  }
  step(dt, gust, mouse) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.step(dt, gust, this.W, this.H);
      if (mouse && mouse.active) p.repel(mouse.x, mouse.y, mouse.radius, mouse.force);
    }
  }
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    for (const p of this.pool) { if (p.active) p.draw(ctx); }
  }
}

export const ParticleEngine = {
  layers: {},
  gust: 0,
  mouse: { x: 0, y: 0, active: false, radius: 130, force: 0.55 },
  lastT: 0,
  running: false,
  mood: 1,
  moodTarget: 1,
  densityScale: 1,
  setMood(v) { this.moodTarget = v; },

  init() {
    const bgC = document.getElementById('petal-bg');
    const midC = document.getElementById('petal-mid');
    const fgC = document.getElementById('petal-fg');

    this.layers.bg = new Layer(bgC, { dpr: 2, speed: 0.6, scaleMin: 0.3, scaleMax: 0.55, opMin: 0.18, opMax: 0.35 });
    this.layers.mid = new Layer(midC, { dpr: 2, speed: 1, scaleMin: 0.55, scaleMax: 0.95, opMin: 0.35, opMax: 0.6 });
    this.layers.fg = new Layer(fgC, { dpr: 2, speed: 1.5, scaleMin: 0.9, scaleMax: 1.4, opMin: 0.55, opMax: 0.85 });

    const updateDensity = () => {
      this.densityScale = clamp((innerWidth * innerHeight) / (1440 * 900), 0.55, 1.65);
    };
    updateDensity();
    this.applyTier(QualityManager.tierName, true);
    window.addEventListener('resize', () => { Object.values(this.layers).forEach((l) => l.resize()); updateDensity(); });

    bus.on('quality:change', ({ tierName }) => this.applyTier(tierName));
    bus.on('petals:mood', (v) => this.setMood(v));
    bus.on('petals:burst', ({ x, y, count, opts }) => this.burst(x, y, count, opts));

    if (QualityManager.hoverCapable) {
      window.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.active = true;
      });
      window.addEventListener('mouseleave', () => (this.mouse.active = false));
    }
  },

  applyTier(name, force) {
    if (!force && name === this._appliedTier) return;
    this._appliedTier = name;
    const t = CONFIG.tiers[name];
    this.layers.bg.canvas.style.filter = t.blur ? 'blur(3px)' : 'none';
    this.layers.mid.canvas.style.filter = t.blur ? 'blur(1px)' : 'none';
    this.layers.bg.fill(Math.round(t.bg * this.densityScale), true);
    this.layers.mid.fill(Math.round(t.mid * this.densityScale), true);
    this.layers.fg.fill(Math.round(t.fg * this.densityScale), true);
  },

  burst(x, y, count, opts) {
    this.layers.mid.burst(x, y, Math.ceil(count * 0.6), opts);
    this.layers.fg.burst(x, y, Math.floor(count * 0.4), opts);
  },

  setGust(v) { this.gust = v; },

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    requestAnimationFrame(this.tick.bind(this));
  },

  tick(now) {
    const dt = Math.min(48, now - this.lastT || 16.7);
    this.lastT = now;

    this.gust *= 0.94;
    this.mood += (this.moodTarget - this.mood) * Math.min(1, dt / 600);

    const tierName = QualityManager.tierName;
    if (tierName !== 'minimal') {
      this.layers.bg.step(dt, this.gust * 0.4, null);
      this.layers.mid.step(dt, this.gust * 0.7, this.mouse);
      this.layers.fg.step(dt, this.gust, this.mouse);
      this.layers.bg.fill(Math.round(CONFIG.tiers[tierName].bg * this.mood * this.densityScale), false);
      this.layers.mid.fill(Math.round(CONFIG.tiers[tierName].mid * this.mood * this.densityScale), false);
      this.layers.fg.fill(Math.round(CONFIG.tiers[tierName].fg * this.mood * this.densityScale), false);
      this.layers.bg.render();
      this.layers.mid.render();
      this.layers.fg.render();
    }

    // feed the live perf monitor; QualityManager decides if/when to step down
    QualityManager.sample(dt);

    if (this.running) requestAnimationFrame(this.tick.bind(this));
  },
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { ParticleEngine.running = false; }
  else if (!ParticleEngine.running) { ParticleEngine.start(); }
});
