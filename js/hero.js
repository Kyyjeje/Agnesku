/* ============================================================
   HERO — magnetic buttons, the trailing cursor petal, the live
   date, and `playHeroBloom` (called from intro.js once the intro
   dissolves, so the two centerpieces never compete for attention).
============================================================ */
'use strict';

/* ---- magnetic CTA + trailing cursor petal ---- */
if (hoverCapable){
  document.querySelectorAll('[data-magnetic]').forEach(el=>{
    el.addEventListener('mousemove', e=>{
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left+r.width/2)) * .3;
      const dy = (e.clientY - (r.top+r.height/2)) * .4;
      gsap.to(el, {x:dx, y:dy, duration:.4, ease:'power2.out'});
    });
    el.addEventListener('mouseleave', ()=> gsap.to(el, {x:0,y:0,duration:.6,ease:'elastic.out(1,0.5)'}));
  });

  const cursor = document.getElementById('petalCursor');
  window.addEventListener('mousemove', e=>{
    cursor.classList.add('active');
    gsap.to(cursor, {x:e.clientX, y:e.clientY, duration:.5, ease:'power3.out'});
  });
}

/* ---- dynamic greeting — a quiet, local-time-aware opener ahead of
   the fixed eyebrow line, rather than replacing it (the original
   copy is the one thing that shouldn't ever feel automated) ---- */
(function greet(){
  const eyebrow = document.getElementById('heroEyebrow');
  if (!eyebrow) return;
  const h = new Date().getHours();
  const greeting = h < 5 ? 'Still awake this late'
                  : h < 12 ? 'Good morning'
                  : h < 17 ? 'Good afternoon'
                  : h < 21 ? 'Good evening'
                  : 'Good night';
  const rest = eyebrow.textContent;
  eyebrow.textContent = `${greeting} — ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
})();

/* ---- hero bloom SVG — the centerpiece flower opening beside her
   name. Held back until the intro finishes. ---- */
function playHeroBloom(){
  const g = document.getElementById('heroBloomGroup');
  if (!g) return; // the hero-bloom decoration was removed from this build — nothing to do
  const petalCount = 10;
  const colors = ['var(--rose)','var(--rose-soft)','var(--rose-bright)'];
  const ns = 'http://www.w3.org/2000/svg';
  for (let i=0;i<petalCount;i++){
    const angle = (360/petalCount)*i;
    const long = i % 2 === 0;
    const p = document.createElementNS(ns,'ellipse');
    p.setAttribute('cx', 0); p.setAttribute('cy', long? -95 : -70);
    p.setAttribute('rx', long? 34: 26); p.setAttribute('ry', long? 95: 70);
    p.setAttribute('fill', colors[i % colors.length]);
    p.setAttribute('opacity', '0.85');
    p.setAttribute('transform', `rotate(${angle}) scale(0.05)`);
    p.style.transformOrigin = '0px 0px';
    g.appendChild(p);
    gsap.to(p, { attr:{transform:`rotate(${angle}) scale(1)`}, duration:2, delay: i*0.045, ease:'elastic.out(0.7,0.55)' });
  }
  const core = document.createElementNS(ns,'circle');
  core.setAttribute('r','30'); core.setAttribute('fill','var(--gold)'); core.setAttribute('opacity','0');
  g.appendChild(core);
  gsap.to(core,{opacity:.95, duration:1, delay:1.1});
  if (!reduceMotion) gsap.to(g, { rotation:360, duration:190, repeat:-1, ease:'none', transformOrigin:'0px 0px' });
}
