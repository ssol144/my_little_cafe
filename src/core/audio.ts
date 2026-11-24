// All sound is synthesized with WebAudio at runtime: no audio assets, no licensing concerns.

type Sfx = 'tap' | 'good' | 'perfect' | 'miss' | 'coin' | 'bell' | 'serve' | 'levelup' | 'error' | 'pop' | 'pour' | 'whoosh';

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxOn = true;
  musicOn = true;
  private musicTimer: number | null = null;
  private step = 0;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);
      if (this.musicOn) this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  suspend() {
    this.ctx?.suspend();
  }
  resume() {
    this.ctx?.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, dest?: AudioNode, slideTo?: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol = 0.15, freq = 1200) {
    if (!this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  play(s: Sfx) {
    if (!this.sfxOn || !this.ctx) return;
    switch (s) {
      case 'tap': this.tone(880, 0.06, 'triangle', 0.15); break;
      case 'pop': this.tone(520, 0.08, 'sine', 0.25, 0, undefined, 900); break;
      case 'good': this.tone(660, 0.12, 'triangle', 0.22); this.tone(990, 0.16, 'triangle', 0.2, 0.08); break;
      case 'perfect': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.2, i * 0.07)); break;
      case 'miss': this.tone(300, 0.2, 'sawtooth', 0.08, 0, undefined, 180); break;
      case 'coin': this.tone(1318, 0.08, 'square', 0.08); this.tone(1760, 0.2, 'square', 0.08, 0.07); break;
      case 'bell': this.tone(1567, 0.6, 'sine', 0.18); this.tone(2093, 0.5, 'sine', 0.1, 0.12); break;
      case 'serve': this.tone(523, 0.1, 'triangle', 0.2); this.tone(784, 0.18, 'triangle', 0.2, 0.09); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, i * 0.09)); break;
      case 'error': this.tone(220, 0.15, 'square', 0.08); this.tone(180, 0.2, 'square', 0.08, 0.1); break;
      case 'pour': this.noise(0.35, 0.12, 900); break;
      case 'whoosh': this.noise(0.25, 0.1, 2400); break;
    }
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  // A gentle music-box loop: I–vi–IV–V in C, pentatonic melody.
  private startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const chords = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]];
    const melody = [784, 659, 587, 523, 587, 659, 784, 880, 784, 659, 523, 587, 659, 523, 440, 392];
    const beat = 0.48;
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const i = this.step++;
      const chord = chords[Math.floor(i / 4) % 4];
      if (i % 4 === 0) chord.forEach((f) => this.tone(f, beat * 3.6, 'sine', 0.07, 0, this.musicGain!));
      if (i % 2 === 0 || Math.random() < 0.35) this.tone(melody[i % melody.length], beat * 1.4, 'triangle', 0.05, 0, this.musicGain!);
    };
    this.musicTimer = window.setInterval(tick, beat * 1000);
  }
  private stopMusic() {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const audio = new AudioEngine();

let vibrateOn = true;
export function setVibration(on: boolean) {
  vibrateOn = on;
}
export function haptic(ms = 15) {
  if (vibrateOn && navigator.vibrate) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
