/* ============================================================
   SceneEngine — the cinematic intro. Three motion layers work
   together: gathering light motes, drifting flower sprites (reused
   from ParticleEngine's own sprite cache), then a full bloom that
   flashes and dissolves into the page's own petal field while the
   hero content crossfades in underneath.

   Talks to the rest of the app only through the bus: it emits
   'petals:burst' instead of importing ParticleEngine, and
   'intro:complete' instead of importing ScrollEngine/Hero directly.
============================================================ */

import { gsap, lenis } from '../core/SmoothScroll.js';
import { CONFIG } from '../core/ConfigEngine.js';
import { QualityManager } from '../core/QualityManager.js';
import { bus } from '../core/EventBus.js';
import { rand } from '../utils/math.js';
import { spriteCache, weightedEmoji } from './ParticleEngine.js';

export function runIntro() {
  const overlay = document.getElementById('intro');
  const canvas = document.getElementById('introCanvas');
  const caption = document.getElementById('introCaption');
  const rays = document.getElementById('introRays');
  const nameEl = document.getElementById('introName');
  const skipBtn = document.getElementById('introSkip');
  const heroContent = document.querySelector('.hero-content');
  document.body.classList.add('intro-active');

  const heroNameEl = document.querySelector('.hero-name');
  const nameStr = heroNameEl ? heroNameEl.textContent.trim() : '';
  const nameLetters = [];
  if (nameEl && nameStr) {
    nameStr.split('').forEach((ch) => {
      const span = document.createElement('span');
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      nameEl.appendChild(span);
      nameLetters.push(span);
    });
  }

  function complete() {
    document.body.classList.remove('intro-active');
    if (heroContent) heroContent.classList.add('reveal');
    lenis.start();
    bus.emit('intro:complete');
  }

  if (QualityManager.reduceMotion) {
    overlay.remove();
    complete();
    return;
  }

  const ctx = canvas.getContext('2d');
  let DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * DPR;
    canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const cx = () => innerWidth / 2;
  const cy = () => innerHeight / 2;

  const motes = Array.from({ length: 26 }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: rand(0.5, 1),
    size: rand(1.4, 3.6),
    twPhase: Math.random() * Math.PI * 2,
    twSpeed: rand(0.0016, 0.0038),
  }));

  const driftFlowers = Array.from({ length: 7 }, () => ({
    sprite: spriteCache.get(weightedEmoji[(Math.random() * weightedEmoji.length) | 0]),
    xStart: rand(-0.2, 1.0),
    y: rand(0.14, 0.86),
    speed: rand(0.055, 0.11),
    size: rand(28, 52),
    bob: rand(10, 20),
    bobSpeed: rand(0.0005, 0.0009),
    bobPhase: Math.random() * Math.PI * 2,
    spin: rand(-0.25, 0.25),
    spinSpeed: rand(-0.0004, 0.0004),
    born: null,
  }));

  const scene = { glow: 0, gather: 0, bloom: 0, spin: 0, flash: 0, drift: 0, opacity: 1 };

  function drawGlow() {
    const R = 240 * (0.35 + scene.glow * 0.75) * (1 + scene.flash * 0.7);
    if (R <= 0) return;
    const g = ctx.createRadialGradient(cx(), cy(), 0, cx(), cy(), R);
    g.addColorStop(0, `rgba(255,222,232,${0.55 * scene.glow + scene.flash * 0.45})`);
    g.addColorStop(0.55, `rgba(255,159,192,${0.26 * scene.glow})`);
    g.addColorStop(1, 'rgba(255,159,192,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx(), cy(), R, 0, Math.PI * 2); ctx.fill();
  }
  function drawMotes(now) {
    const R = Math.min(innerWidth, innerHeight) * 0.6;
    motes.forEach((m) => {
      const d = m.dist * R * (1 - scene.gather);
      const x = cx() + Math.cos(m.angle) * d;
      const y = cy() + Math.sin(m.angle) * d;
      const tw = 0.5 + Math.sin(now * m.twSpeed + m.twPhase) * 0.5;
      ctx.globalAlpha = (0.22 + tw * 0.55) * (1 - scene.gather * 0.4);
      ctx.fillStyle = '#ffe3ee';
      ctx.beginPath(); ctx.arc(x, y, m.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function drawDriftFlowers(now) {
    if (scene.drift <= 0) return;
    driftFlowers.forEach((f) => {
      if (f.born === null) f.born = now;
      const t = (now - f.born) / 1000;
      const x = ((f.xStart + f.speed * t * 0.12) % 1.3 - 0.15) * innerWidth;
      const y = f.y * innerHeight + Math.sin(now * f.bobSpeed + f.bobPhase) * f.bob;
      const rot = f.spin + now * f.spinSpeed;
      ctx.save();
      ctx.globalAlpha = scene.drift * 0.8;
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(f.sprite, -f.size / 2, -f.size / 2, f.size, f.size);
      ctx.restore();
    });
  }
  function drawFlower() {
    if (scene.bloom <= 0) return;
    const petals = 8;
    const colors = [CONFIG.colors.rose, CONFIG.colors.roseSoft, CONFIG.colors.roseBright];
    ctx.save();
    ctx.translate(cx(), cy());
    ctx.rotate(scene.spin);
    const len = 96 * scene.bloom, wid = 34 * scene.bloom;
    for (let i = 0; i < petals; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 / petals) * i);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.ellipse(0, -len * 0.55, wid * 0.5, len * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = CONFIG.colors.gold;
    ctx.beginPath(); ctx.arc(0, 0, 15 * scene.bloom, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawLensBloom() {
    if (scene.flash <= 0) return;
    ctx.save();
    ctx.globalAlpha = scene.flash * 0.5;
    ctx.strokeStyle = '#ffe9f1';
    [1, 1.6].forEach((m, i) => {
      ctx.globalAlpha = scene.flash * (0.32 - i * 0.14);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx(), cy(), 70 * m * (0.6 + scene.flash * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = scene.flash * 0.55;
    ctx.fillStyle = '#fff6fa';
    ctx.fillRect(0, cy() - 0.6, innerWidth, 1.2);
    ctx.fillRect(cx() - 0.6, 0, 1.2, innerHeight);
    ctx.restore();
  }
  function drawScene(now) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (scene.opacity <= 0) return;
    ctx.save();
    ctx.globalAlpha = scene.opacity;
    drawGlow();
    drawDriftFlowers(now);
    drawMotes(now);
    drawFlower();
    drawLensBloom();
    ctx.restore();
  }

  let raf;
  (function loop(now) { drawScene(now || 0); raf = requestAnimationFrame(loop); })();

  function finish() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    overlay.remove();
    complete();
  }

  overlay.style.filter = 'blur(0px)';
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: finish });

  gsap.to(canvas, { scale: 1.045, duration: 9.5, ease: 'sine.inOut' });

  tl.to(scene, { drift: 1, duration: 0.9, ease: 'sine.out' })
    .call(() => { if (rays) rays.classList.add('on'); }, null, '-=.6')
    .to(scene, { glow: 1, duration: 1.0, ease: 'sine.inOut' }, '-=.55')
    .to(scene, { gather: 1, duration: 1.15, ease: 'power3.inOut' }, '-=.55')
    .to(caption, { opacity: 1, duration: 0.6 }, '-=.7')
    .to(scene, { drift: 0, duration: 0.8, ease: 'sine.in' }, '-=.9')
    .to(caption, { opacity: 0, duration: 0.4 }, '+=.1')
    .to(nameLetters, {
      opacity: 1, filter: 'blur(0px)', y: 0, scale: 1,
      duration: 0.9, ease: 'power2.out', stagger: 0.045,
    }, '-=.1')
    .to({}, { duration: 0.5 })
    .to(nameLetters, { opacity: 0, filter: 'blur(10px)', duration: 0.5, ease: 'sine.in', stagger: 0.02 })
    .to(scene, { bloom: 1, spin: 0.35, duration: 1.35, ease: 'elastic.out(0.7,0.6)' }, '-=.2')
    .call(() => { if (rays) rays.classList.remove('on'); }, null, '-=.9')
    .to(scene, { flash: 1, duration: 0.32, ease: 'power2.out' }, '+=.05')
    .call(() => {
      bus.emit('petals:burst', { x: cx(), y: cy(), count: 30, opts: { spread: Math.PI * 2, minSpeed: 4, maxSpeed: 10, gravity: 0.12, maxLife: 4200 } });
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        gsap.delayedCall(i * 0.05, () => {
          bus.emit('petals:burst', { x: rand(0, innerWidth), y: innerHeight + 20, count: 3, opts: { spread: Math.PI * 0.5, minSpeed: 4, maxSpeed: 8, gravity: 0.12, maxLife: 4200 } });
        });
      }
    })
    .to(scene, { flash: 0, duration: 0.6 }, '+=.05')
    .call(() => { if (heroContent) heroContent.classList.add('reveal'); bus.emit('hero:bloom'); }, null, '+=.9')
    .to(scene, { opacity: 0, duration: 0.9, ease: 'sine.in' }, '<')
    .to(overlay, { opacity: 0, duration: 0.9, pointerEvents: 'none', filter: 'blur(10px)', ease: 'sine.in' }, '<');

  skipBtn.addEventListener('click', () => tl.progress(1));

  const blockScroll = (e) => e.preventDefault();
  overlay.addEventListener('wheel', blockScroll, { passive: false });
  overlay.addEventListener('touchmove', blockScroll, { passive: false });
}
