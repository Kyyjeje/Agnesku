/* ============================================================
   AudioEngine — headless playback logic for the one soundtrack:
   smooth fade in/out, volume automation (ducks gently during the
   letter, swells at the finale — reusing the same 'petals:mood'
   signal ScrollEngine already emits, so the music and the petal
   field breathe together instead of each needing their own scroll
   listener), pause-memory across visits, and mute.

   Deliberately headless: this module never touches the DOM beyond
   the <audio> element itself. Button wiring, the scrub bar, and
   time labels live in components/MusicPlayerUI.js, which is the
   only part that changes if the player's markup ever changes.
============================================================ */

import { CONFIG } from '../core/ConfigEngine.js';
import { StorageEngine } from '../core/StorageEngine.js';
import { bus } from '../core/EventBus.js';

export function createAudioEngine(audioEl) {
  const { storeKey, fadeMs, targetVolume, saveIntervalMs } = CONFIG.audio;
  let fadeRAF = null;
  let muted = StorageEngine.get(`${storeKey}:muted`, false);
  let moodVolumeScale = 1; // set by petals:mood, multiplies targetVolume

  audioEl.muted = muted;

  function fadeTo(target, ms, onDone) {
    cancelAnimationFrame(fadeRAF);
    const start = audioEl.volume;
    const delta = target - start;
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / ms);
      audioEl.volume = start + delta * (p * (2 - p)); // ease-out
      if (p < 1) fadeRAF = requestAnimationFrame(step);
      else if (onDone) onDone();
    })(t0);
  }

  function currentTarget() {
    return targetVolume * moodVolumeScale;
  }

  function play() {
    audioEl.volume = 0;
    return audioEl.play().then(() => fadeTo(currentTarget(), fadeMs));
  }

  function pause() {
    return new Promise((resolve) => fadeTo(0, fadeMs, () => { audioEl.pause(); resolve(); }));
  }

  function toggleMute() {
    muted = !muted;
    audioEl.muted = muted;
    StorageEngine.set(`${storeKey}:muted`, muted);
    return muted;
  }

  function saveState() {
    StorageEngine.set(storeKey, { time: audioEl.currentTime || 0, playing: !audioEl.paused });
  }

  function restoreState() {
    const saved = StorageEngine.get(storeKey, null);
    if (saved && saved.time > 0 && saved.time < (audioEl.duration || Infinity) - 1) {
      audioEl.currentTime = saved.time;
    }
  }

  // Volume automation: reuse ScrollEngine's ambient-mood signal
  // (0.45 at the letter, 1 baseline, 1.7 at the finale) so the
  // track quietly recedes for the letter and lifts for the finale,
  // without a second, separate scroll listener of its own.
  bus.on('petals:mood', (mood) => {
    moodVolumeScale = 0.7 + (mood - 1) * 0.18; // gentle, not a hard duck
    if (!audioEl.paused) fadeTo(currentTarget(), 600);
  });

  audioEl.addEventListener('ended', saveState);
  window.addEventListener('beforeunload', saveState);
  setInterval(() => { if (!audioEl.paused) saveState(); }, saveIntervalMs);

  return { play, pause, toggleMute, saveState, restoreState, get muted() { return muted; } };
}
