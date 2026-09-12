/* ============================================================
   MusicPlayerUI — DOM wiring only. All playback logic (fades,
   volume automation, pause-memory, mute) lives in AudioEngine;
   this module just reflects that state into the markup and turns
   clicks/drags into calls on it.
============================================================ */

import { createAudioEngine } from '../engines/AudioEngine.js';
import { clamp } from '../utils/math.js';
import { fmtTime } from '../utils/dom.js';

export function initMusicPlayerUI() {
  const audio = document.getElementById('audioEl');
  const wrap = document.getElementById('player');
  const playBtn = document.getElementById('trackPlayBtn');
  const muteBtn = document.getElementById('trackMuteBtn');
  const scrub = document.getElementById('trackScrub');
  const scrubFill = document.getElementById('trackScrubFill');
  const curEl = document.getElementById('trackCurrent');
  const durEl = document.getElementById('trackDuration');
  if (!audio) return;

  const engine = createAudioEngine(audio);
  let scrubbing = false;

  if (muteBtn) {
    muteBtn.classList.toggle('is-muted', engine.muted);
    muteBtn.addEventListener('click', () => {
      const muted = engine.toggleMute();
      muteBtn.classList.toggle('is-muted', muted);
      muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    });
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      engine.play().then(() => wrap.classList.add('playing')).catch(() => wrap.classList.remove('playing'));
    } else {
      engine.pause().then(() => wrap.classList.remove('playing'));
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    durEl.textContent = fmtTime(audio.duration);
    engine.restoreState();
  });
  audio.addEventListener('timeupdate', () => {
    if (scrubbing) return;
    curEl.textContent = fmtTime(audio.currentTime);
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    scrubFill.style.width = pct + '%';
    scrub.setAttribute('aria-valuenow', Math.round(pct));
  });
  audio.addEventListener('ended', () => wrap.classList.remove('playing'));

  function seekFromEvent(e) {
    const r = scrub.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const pct = clamp((clientX - r.left) / r.width, 0, 1);
    if (audio.duration) audio.currentTime = pct * audio.duration;
    scrubFill.style.width = pct * 100 + '%';
  }
  scrub.addEventListener('pointerdown', (e) => { scrubbing = true; seekFromEvent(e); });
  window.addEventListener('pointermove', (e) => { if (scrubbing) seekFromEvent(e); });
  window.addEventListener('pointerup', () => { scrubbing = false; });
  scrub.addEventListener('keydown', (e) => {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  });
}
