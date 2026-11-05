// Procedural WebAudio sound system. No external assets.
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.ambient = null;
    this.volume = 0.8;
    this.enabled = true;
    this.started = false;
    this.stepTimer = 0;
    this._lastThunder = 0;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 5;
    comp.attack.value = 0.003; comp.release.value = 0.24;
    this.master.connect(comp).connect(c.destination);

    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.ambient = c.createGain(); this.ambient.gain.value = 0.5; this.ambient.connect(this.master);

    // Reverb impulse: dark concrete courtyard.
    this.reverb = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.4);
    const imp = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = imp.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (0.6 + 0.4 * Math.sin(i * 0.0007));
      }
    }
    this.reverb.buffer = imp;
    this.reverbGain = c.createGain(); this.reverbGain.gain.value = 0.42;
    this.reverb.connect(this.reverbGain).connect(this.master);

    // Noise source buffer.
    const nlen = c.sampleRate * 2;
    this.noise = c.createBuffer(2, nlen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = this.noise.getChannelData(ch);
      for (let i = 0; i < nlen; i++) d[i] = Math.random() * 2 - 1;
    }
    this.started = true;
    this.startAmbience();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? v : 0, this.ctx.currentTime, 0.05);
  }
  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
  }

  _now() { return this.ctx.currentTime; }

  _noise(duration, { type = 'bandpass', freq = 1000, freqEnd = null, q = 0.9, gain = 0.3, attack = 0.004, pan = 0, dest = null, send = 0.25, rate = 1 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); src.connect(f).connect(g).connect(p); p.connect(dest || this.sfx); if (send) p.connect(this.reverb); }
    else { src.connect(f).connect(g).connect(dest || this.sfx); if (send) g.connect(this.reverb); }
    src.start(t, Math.random() * 1.5); src.stop(t + duration + 0.02);
  }

  _tone(freq, { type = 'sine', freqEnd = null, dur = 0.2, gain = 0.15, attack = 0.004, pan = 0, send = 0.12 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); o.connect(g).connect(p); p.connect(this.sfx); if (send) p.connect(this.reverb); }
    else { o.connect(g).connect(this.sfx); if (send) g.connect(this.reverb); }
    o.start(t); o.stop(t + dur + 0.02);
  }

  startAmbience() {
    if (!this.ctx || this.ambientStarted) return;
    this.ambientStarted = true;
    const c = this.ctx;
    // Steady rain hiss.
    const rain = c.createBufferSource(); rain.buffer = this.noise; rain.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6200;
    const rg = c.createGain(); rg.gain.value = 0.055;
    rain.connect(hp).connect(lp).connect(rg).connect(this.ambient);
    rain.start();
    // Wind bed with slow modulation.
    const wind = c.createBufferSource(); wind.buffer = this.noise; wind.loop = true; wind.playbackRate.value = 0.4;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 340; wf.Q.value = 0.55;
    const wg = c.createGain(); wg.gain.value = 0.07;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.09;
    const lfoG = c.createGain(); lfoG.gain.value = 0.035;
    lfo.connect(lfoG).connect(wg.gain); lfo.start();
    wind.connect(wf).connect(wg).connect(this.ambient); wind.start();
    // Sub drone.
    const dg = c.createGain(); dg.gain.value = 0.035;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 200;
    [41.2, 61.7, 82.4].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = i === 0 ? 0.5 : 0.13;
      o.connect(g).connect(dlp); o.start();
    });
    dlp.connect(dg).connect(this.ambient);
  }

  shot(kind = 'rifle') {
    if (!this.ctx || !this.enabled) return;
    if (kind === 'rifle') {
      this._noise(0.14, { type: 'highpass', freq: 1600, freqEnd: 500, gain: 0.44, q: 0.6, send: 0.38 });
      this._noise(0.22, { type: 'bandpass', freq: 420, freqEnd: 120, gain: 0.36, q: 0.7, send: 0.5 });
      this._tone(120, { type: 'sine', freqEnd: 42, dur: 0.2, gain: 0.40, send: 0.4 });
      this._tone(340, { type: 'square', freqEnd: 90, dur: 0.05, gain: 0.08, send: 0.1 });
    } else if (kind === 'pistol') {
      this._noise(0.1, { type: 'highpass', freq: 2100, freqEnd: 700, gain: 0.32, q: 0.7, send: 0.3 });
      this._noise(0.18, { type: 'bandpass', freq: 600, freqEnd: 180, gain: 0.3, q: 0.8, send: 0.4 });
      this._tone(160, { type: 'sine', freqEnd: 55, dur: 0.14, gain: 0.3, send: 0.3 });
    }
  }

  enemyShot(distance = 20, pan = 0) {
    if (!this.ctx || !this.enabled) return;
    const g = Math.max(0.05, 0.26 - distance * 0.008);
    this._noise(0.13, { type: 'bandpass', freq: 900, freqEnd: 180, gain: g, q: 0.7, pan, send: 0.7 });
    this._tone(80, { type: 'sine', freqEnd: 38, dur: 0.16, gain: g * 0.8, pan, send: 0.6 });
  }

  reload(stage = 0) {
    if (!this.ctx || !this.enabled) return;
    if (stage === 0) { this._noise(0.05, { type: 'highpass', freq: 2600, gain: 0.16, q: 1, send: 0.1 }); this._tone(210, { type: 'square', dur: 0.04, gain: 0.04 }); }
    else if (stage === 1) { this._noise(0.07, { type: 'bandpass', freq: 1200, gain: 0.18, q: 1.4, send: 0.15 }); this._tone(140, { type: 'sine', freqEnd: 80, dur: 0.09, gain: 0.1 }); }
    else { this._noise(0.05, { type: 'highpass', freq: 1900, gain: 0.2, q: 1.2, send: 0.12 }); this._tone(320, { type: 'square', dur: 0.035, gain: 0.05 }); }
  }

  switchWeapon() { this._noise(0.07, { type: 'bandpass', freq: 1700, gain: 0.12, q: 1.1, send: 0.1 }); this._tone(180, { type: 'triangle', dur: 0.06, gain: 0.04 }); }
  dryFire() { this._noise(0.035, { type: 'highpass', freq: 3000, gain: 0.14, q: 2, send: 0.05 }); this._tone(900, { type: 'square', dur: 0.03, gain: 0.04, send: 0.02 }); }
  hit(head = false) {
    if (!this.ctx || !this.enabled) return;
    this._tone(head ? 1680 : 1080, { type: 'triangle', dur: 0.07, gain: head ? 0.12 : 0.08, send: 0.05 });
    if (head) this._tone(2520, { type: 'sine', dur: 0.16, gain: 0.08, send: 0.1 });
  }
  kill(head = false) {
    this._tone(760, { type: 'triangle', dur: 0.08, gain: 0.09, send: 0.08 });
    setTimeout(() => this._tone(1140, { type: 'triangle', dur: 0.14, gain: 0.07, send: 0.1 }), 55);
    if (head) this._noise(0.12, { type: 'highpass', freq: 4200, gain: 0.06, q: 1, send: 0.2 });
  }
  hurt() {
    if (!this.ctx || !this.enabled) return;
    this._noise(0.2, { type: 'lowpass', freq: 500, freqEnd: 100, gain: 0.3, send: 0.5 });
    this._tone(70, { type: 'sine', freqEnd: 38, dur: 0.3, gain: 0.26, send: 0.4 });
  }
  step(metal = false) { this._noise(0.07, { type: metal ? 'bandpass' : 'lowpass', freq: metal ? 1600 : 330, gain: 0.045, q: 1, send: 0.08 }); }
  explosion() {
    if (!this.ctx || !this.enabled) return;
    this._noise(1.2, { type: 'lowpass', freq: 1400, freqEnd: 65, gain: 0.75, q: 0.6, attack: 0.008, send: 0.9 });
    this._tone(66, { type: 'sine', freqEnd: 24, dur: 1.0, gain: 0.6, send: 0.9 });
    this._noise(0.18, { type: 'highpass', freq: 2400, freqEnd: 500, gain: 0.32, q: 0.5, send: 0.8 });
  }
  grenadeBounce() { this._tone(260, { type: 'triangle', freqEnd: 170, dur: 0.09, gain: 0.1, send: 0.2 }); }
  throwGrenade() { this._noise(0.13, { type: 'bandpass', freq: 800, freqEnd: 400, gain: 0.09, q: 0.8, send: 0.1 }); }
  alarm() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      const g = c.createGain(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
      o.frequency.setValueAtTime(180, t + i * 0.65);
      o.frequency.linearRampToValueAtTime(400, t + i * 0.65 + 0.42);
      o.frequency.linearRampToValueAtTime(180, t + i * 0.65 + 0.6);
      g.gain.setValueAtTime(0.0001, t + i * 0.65);
      g.gain.exponentialRampToValueAtTime(0.09, t + i * 0.65 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.65 + 0.6);
      o.connect(f).connect(g).connect(this.sfx); g.connect(this.reverb); o.start(t + i * 0.65); o.stop(t + i * 0.65 + 0.65);
    }
  }
  thunder() {
    const now = performance.now();
    if (now - this._lastThunder < 9000) return;
    this._lastThunder = now;
    if (!this.ctx || !this.enabled) return;
    this._noise(2.4, { type: 'lowpass', freq: 380, freqEnd: 60, gain: 0.32, attack: 0.25, send: 0.9 });
    this._tone(44, { type: 'sine', freqEnd: 28, dur: 2.0, gain: 0.18, send: 0.6 });
  }
  ui(ok = true) { this._tone(ok ? 620 : 320, { type: 'triangle', dur: 0.06, gain: 0.05, send: 0.05 }); }
  pickup() { this._tone(520, { type: 'sine', dur: 0.07, gain: 0.07 }); setTimeout(() => this._tone(780, { type: 'sine', dur: 0.1, gain: 0.07 }), 70); }
  victory() {
    if (!this.ctx || !this.enabled) return;
    [130.8, 196, 261.6, 329.6, 392].forEach((f, i) => {
      setTimeout(() => this._tone(f, { type: 'triangle', dur: 2.4, gain: 0.07, attack: 0.05, send: 0.7 }), i * 190);
    });
  }
  defeat() {
    if (!this.ctx || !this.enabled) return;
    [110, 87.3, 65.4].forEach((f, i) => {
      setTimeout(() => this._tone(f, { type: 'sawtooth', dur: 2.0, gain: 0.07, attack: 0.1, send: 0.7 }), i * 320);
    });
  }
  heartbeat() {
    if (!this.ctx || !this.enabled) return;
    this._tone(57, { type: 'sine', freqEnd: 40, dur: 0.14, gain: 0.22, send: 0.2 });
    setTimeout(() => this._tone(50, { type: 'sine', freqEnd: 36, dur: 0.12, gain: 0.14, send: 0.2 }), 165);
  }
}
