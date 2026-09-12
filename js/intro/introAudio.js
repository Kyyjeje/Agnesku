/* ============================================================
   INTRO ENGINE — introAudio.js
   Ambient atmosphere via the Web Audio API — no external audio
   file required. A four-voice sine pad tuned to an A-major chord
   fades in beneath the visuals, adding emotional weight without
   overwhelming the experience.

   Designed to be inaudible in the first second, peaking at a
   very low master gain so it reads as atmosphere rather than music.
   The tremolo (gain LFO) adds a slow breath, matching the visual
   bloom pulse.

   Graceful degradation: if AudioContext is unavailable or the user
   hasn't interacted yet (browser autoplay policy), the audio system
   silently skips. The intro remains fully functional without sound.
============================================================ */
'use strict';

const IntroAudio = (() => {

  let audioCtx   = null;
  let masterGain = null;
  let tremoloOsc = null;
  let tremoloGain= null;
  let voices     = [];
  let started    = false;

  function tryInit() {
    if (audioCtx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioCtx = new AC();
      return true;
    } catch(e) {
      return false;
    }
  }

  /* ── Build the audio graph ──────────────────────────────── */
  function buildGraph() {
    const cfg = INTRO_CFG.audio;

    masterGain      = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    // Tremolo: an LFO modulating overall gain — creates the "breath"
    tremoloOsc  = audioCtx.createOscillator();
    tremoloGain = audioCtx.createGain();
    tremoloOsc.type            = 'sine';
    tremoloOsc.frequency.value = cfg.tremoloRate;
    tremoloGain.gain.value     = cfg.tremoloDepth;
    tremoloOsc.connect(tremoloGain);
    tremoloGain.connect(masterGain.gain);
    tremoloOsc.start();

    // Low-pass filter: warm the sound, remove any digitally-crisp highs
    const lpf = audioCtx.createBiquadFilter();
    lpf.type            = 'lowpass';
    lpf.frequency.value = 1800;
    lpf.Q.value         = 0.7;
    lpf.connect(masterGain);

    // Four voices — each slightly detuned for a natural chorus
    cfg.frequencies.forEach((baseFreq, i) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type               = 'sine';
      osc.frequency.value    = baseFreq;
      // Slight random detune per voice (±3 cents) to avoid phase cancellation
      osc.detune.value       = (Math.random() - 0.5) * 6;
      // Softer gain for higher harmonics
      gain.gain.value        = (0.18 / cfg.frequencies.length) * (1 - i * 0.04);
      osc.connect(gain);
      gain.connect(lpf);
      osc.start();
      voices.push({ osc, gain });
    });
  }

  /* ── Public interface ────────────────────────────────────── */

  // Called once from introTimeline — unlocks AudioContext (needs user
  // interaction already to have happened; intro skip button click or
  // the page load itself satisfies most browsers' policies)
  function start() {
    if (!INTRO_CFG.audio.enabled || started) return;
    started = true;
    if (!tryInit()) return;    // AudioContext unavailable — silent fallback
    if (audioCtx.state === 'suspended') {
      // Resume on the next user gesture if we're still suspended
      const resume = () => {
        audioCtx.resume();
        window.removeEventListener('pointerdown', resume);
      };
      window.addEventListener('pointerdown', resume, { once: true });
    }
    buildGraph();
    // Fade master gain in slowly
    const cfg = INTRO_CFG.audio;
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(cfg.peakGain, audioCtx.currentTime + cfg.fadeInDur);
  }

  // Called from introTransition — fade out gracefully
  function fadeOut() {
    if (!audioCtx || !masterGain) return;
    const cfg = INTRO_CFG.audio;
    const now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0, now + cfg.fadeOutDur);
  }

  // Tear down after fade completes
  function destroy() {
    voices.forEach(v => { try { v.osc.stop(); } catch(e){} });
    voices = [];
    if (tremoloOsc) { try { tremoloOsc.stop(); } catch(e){} }
    if (audioCtx)   { try { audioCtx.close();  } catch(e){} }
    audioCtx = masterGain = tremoloOsc = tremoloGain = null;
    started  = false;
  }

  return { start, fadeOut, destroy };

})();
