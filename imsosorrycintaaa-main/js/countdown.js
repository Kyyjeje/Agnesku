/* ============================================================
   COUNTDOWN — petal-dial countdown to CONFIG.countdown.exactDate,
   or a rolling "one year from today" if that's left null.
============================================================ */
'use strict';

(function countdown(){
  const today = new Date();
  const NEXT_BIRTHDAY = CONFIG.countdown.exactDate
    || new Date(today.getFullYear()+1, today.getMonth(), today.getDate());

  const dials = document.querySelectorAll('.dial');
  dials.forEach(d=>{
    const r = parseFloat(d.querySelector('.prog').getAttribute('r'));
    const circ = 2*Math.PI*r;
    d.querySelector('.prog').style.strokeDasharray = circ;
    d.dataset.circ = circ;
  });
  function tick(){
    const diff = Math.max(0, NEXT_BIRTHDAY - new Date());
    const d = Math.floor(diff/86400000);
    const h = Math.floor(diff/3600000)%24;
    const m = Math.floor(diff/60000)%60;
    const s = Math.floor(diff/1000)%60;
    const vals = {days:[d,365], hours:[h,24], minutes:[m,60], seconds:[s,60]};
    dials.forEach(dial=>{
      const unit = dial.dataset.unit;
      const [v,max] = vals[unit];
      dial.querySelector('.val').textContent = String(v).padStart(2,'0');
      const prog = dial.querySelector('.prog');
      const circ = parseFloat(dial.dataset.circ);
      prog.style.strokeDashoffset = circ * (1 - Math.min(1, v/max));
    });
  }
  // Pause the tick while the tab is hidden — a background tab has no
  // reason to keep waking the page up once a second, and resuming
  // simply re-syncs to the true clock the moment it's visible again.
  let timer = setInterval(tick, 1000);
  tick();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){ clearInterval(timer); }
    else { tick(); timer = setInterval(tick, 1000); }
  });
})();
