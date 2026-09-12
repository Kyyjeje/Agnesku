/* ============================================================
   NAVIGATION — the bloom toggle and the full-screen index it
   opens. `gardenIndexLinks` and `closeIndex` are also used by
   scroll-reveal.js (active-link syncing) and app.js (in-page
   anchor clicks).
============================================================ */
'use strict';

const bloomToggle = document.getElementById('bloomToggle');
const gardenIndex  = document.getElementById('gardenIndex');
const gardenIndexLinks = gardenIndex.querySelectorAll('a');
const blockScrollLeak = (e) => e.preventDefault();

function setIndexOpen(open){
  gardenIndex.classList.toggle('open', open);
  bloomToggle.classList.toggle('open', open);
  bloomToggle.setAttribute('aria-expanded', String(open));
  gardenIndex.setAttribute('aria-hidden', String(!open));
  gardenIndexLinks.forEach(a => a.tabIndex = open ? 0 : -1);
  // lock the page behind the full-screen index so scroll can never
  // leak through the overlay while it's open
  if (open){
    lenis.stop();
    gardenIndex.addEventListener('wheel', blockScrollLeak, {passive:false});
    gardenIndex.addEventListener('touchmove', blockScrollLeak, {passive:false});
  } else {
    lenis.start();
    gardenIndex.removeEventListener('wheel', blockScrollLeak);
    gardenIndex.removeEventListener('touchmove', blockScrollLeak);
  }
}
function closeIndex(){ setIndexOpen(false); }
setIndexOpen(false);

let toggleLocked = false;
// the full-screen index blooms outward from wherever the toggle
// actually sits, so it stays visually anchored to the control that
// opened it at every breakpoint instead of assuming a fixed corner
function syncRevealOrigin(){
  const r = bloomToggle.getBoundingClientRect();
  const x = ((r.left + r.width/2) / innerWidth) * 100;
  const y = ((r.top + r.height/2) / innerHeight) * 100;
  gardenIndex.style.setProperty('--reveal-x', x + '%');
  gardenIndex.style.setProperty('--reveal-y', y + '%');
}
syncRevealOrigin();
// Debounced via rAF — mobile fires `resize` repeatedly during address-bar
// show/hide and on-screen keyboard open/close; no need to re-read layout
// and write a custom property on every one of those intermediate events.
let revealOriginRAF = null;
window.addEventListener('resize', () => {
  if (revealOriginRAF) return;
  revealOriginRAF = requestAnimationFrame(() => { revealOriginRAF = null; syncRevealOrigin(); });
});
bloomToggle.addEventListener('click', ()=>{
  if (toggleLocked) return; // guards against accidental double-taps mid-transition
  toggleLocked = true;
  syncRevealOrigin();
  setIndexOpen(!gardenIndex.classList.contains('open'));
  setTimeout(()=> toggleLocked = false, 900); // matches the clip-path transition
});
document.addEventListener('keydown', e=>{
  if (e.key === 'Escape' && gardenIndex.classList.contains('open')) closeIndex();
});
