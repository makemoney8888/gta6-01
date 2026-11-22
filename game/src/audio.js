// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, crashes, pickups and mission jingles are built from
// oscillators and filtered noise, and start only after the first user gesture.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let sirenOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that wails between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(duration) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, duration, type, volume, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  return {
    /** Call from any user gesture; safe to call repeatedly. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') void ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** speedRatio 0..1 while driving; 0 and not driving silences the engine. */
    setEngine(speedRatio, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.05 + speedRatio * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenOn = on;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) {
        const now = ctx.currentTime;
        sirenOsc.frequency.cancelScheduledValues(now);
        sirenOsc.frequency.setValueAtTime(720, now);
        for (let i = 0; i < 8; i += 1) {
          sirenOsc.frequency.linearRampToValueAtTime(i % 2 === 0 ? 980 : 720, now + 0.4 * (i + 1));
        }
      }
    },
    isSirenOn() {
      return sirenOn;
    },
    gunshot() {
      noiseBurst(0.12, 0.5, 2600);
      blip(160, 0.08, 'square', 0.18);
    },
    enemyShot() {
      noiseBurst(0.1, 0.28, 1800);
    },
    crash(intensity = 1) {
      noiseBurst(0.25, 0.35 * intensity, 700);
      blip(70, 0.2, 'sine', 0.3 * intensity);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      blip(880, 0.12, 'sine', 0.3, 0.08);
      blip(1320, 0.16, 'sine', 0.25, 0.16);
    },
    coin() {
      blip(990, 0.07, 'triangle', 0.22);
      blip(1480, 0.1, 'triangle', 0.18, 0.06);
    },
    missionComplete() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.18, 'triangle', 0.3, i * 0.11));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.25, 'sawtooth', 0.16, i * 0.16));
    },
    wantedUp() {
      blip(220, 0.14, 'square', 0.2);
      blip(165, 0.2, 'square', 0.2, 0.12);
    },
    phone() {
      blip(880, 0.08, 'sine', 0.25);
      blip(880, 0.08, 'sine', 0.25, 0.14);
    },
  };
}
