/* ============================================================
   SCROLL REVEAL — everything driven by scroll position: section
   fade-ins, the letter's slower paced reveal, ambient "mood"
   (petal density) per section, active-link syncing in the full
   index, and the gallery's depth parallax.

   Exposes `initScrollFX`, called from intro.js once the intro
   dissolves (so ScrollTrigger doesn't fight the locked scroll).
============================================================ */
'use strict';

function initScrollFX(){
  // whole-page scroll progress, filling the hairline under the nav —
  // a single scrubbed tween, cheap because it's one ScrollTrigger for
  // the entire document rather than per-section math
  const progressBar = document.getElementById('scrollProgress');
  if (progressBar){
    gsap.to(progressBar, {
      scaleX: 1, ease:'none',
      scrollTrigger: { trigger: document.body, start:'top top', end:'bottom bottom', scrub:0.3 }
    });
  }

  // memory counter — counts up to the number of actual gallery photos
  // (never hard-coded) the first time the gallery head comes into view
  const memoryCountEl = document.getElementById('memoryCount');
  if (memoryCountEl){
    const total = document.querySelectorAll('.press-card').length;
    ScrollTrigger.create({
      trigger:'#gallery', start:'top 75%', once:true,
      onEnter: () => {
        const counter = { n:0 };
        gsap.to(counter, {
          n: total, duration:1.1, ease:'power1.out',
          onUpdate: () => memoryCountEl.textContent = Math.round(counter.n)
        });
      }
    });
  }

  gsap.utils.toArray('.section-head, .note, .player, .dial-row').forEach(el=>{
    gsap.fromTo(el, {opacity:0, y:40}, {
      opacity:1, y:0, duration:.9, ease:'power3.out',
      scrollTrigger:{ trigger: el, start:'top 88%' }
    });
  });

  // The letter is the emotional peak — it gets its own slower pace:
  // drop cap first, then each paragraph in turn, then the signature.
  // Nothing else on the page reveals this deliberately.
  const letterParts = gsap.utils.toArray('.letter-drop, .letter p, .letter-sign');
  if (letterParts.length){
    gsap.fromTo(letterParts, {opacity:0, y:26}, {
      opacity:1, y:0, duration:1.1, ease:'power2.out', stagger:0.35,
      scrollTrigger:{ trigger:'.letter', start:'top 80%' }
    });
  }

  ScrollTrigger.create({
    trigger: '#message', start:'top 60%', end:'bottom 40%',
    onEnter: () => engine.setMood(0.45), onEnterBack: () => engine.setMood(0.45),
    onLeave: () => engine.setMood(1), onLeaveBack: () => engine.setMood(1)
  });
  ScrollTrigger.create({
    trigger: '#finale', start:'top 65%',
    onEnter: () => engine.setMood(1.7), onLeaveBack: () => engine.setMood(1)
  });

  // keep the full index, the always-visible nav bar, and the nav's
  // live chapter indicator all in sync with scroll position
  const sectionOrder = ['#hero','#gallery','#reasons','#message','#playlist','#countdown','#finale'];
  const navChapterNum   = document.getElementById('navChapterNum');
  const navChapterTotal = document.getElementById('navChapterTotal');
  const navLinks = document.querySelectorAll('#navLinks a');
  if (navChapterTotal) navChapterTotal.textContent = String(sectionOrder.length).padStart(2,'0');

  function setActiveSection(id){
    gardenIndexLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
    if (navChapterNum){
      const idx = sectionOrder.indexOf(id);
      if (idx > -1) navChapterNum.textContent = String(idx+1).padStart(2,'0');
    }
  }
  sectionOrder.forEach(id=>{
    ScrollTrigger.create({
      trigger:id, start:'top 55%', end:'bottom 55%',
      onToggle: self => { if (self.isActive) setActiveSection(id); }
    });
  });
  setActiveSection('#hero');

  gsap.utils.toArray('.press-card').forEach((card,i)=>{
    gsap.fromTo(card, {opacity:0, y:50}, {
      opacity:1, y:0, duration:.8, delay:i*0.05, ease:'power3.out',
      scrollTrigger:{ trigger: card, start:'top 92%' }
    });
  });
  ScrollTrigger.matchMedia({
    '(min-width: 701px)': () => {
      document.querySelectorAll('.press-card').forEach(card=>{
        const depth = parseFloat(card.dataset.depth || .5);
        gsap.to(card, {
          y: -120*depth, ease:'none',
          scrollTrigger:{ trigger:'#pressField', start:'top bottom', end:'bottom top', scrub:true }
        });
      });
    }
  });
  document.querySelectorAll('.press-card').forEach(card=>{
    card.addEventListener('mouseenter', ()=> gsap.to(card, {scale:1.04, duration:.5, ease:'power3.out', zIndex:5}));
    card.addEventListener('mouseleave', ()=> gsap.to(card, {scale:1, duration:.5, ease:'power3.out', zIndex:1}));
  });
}
