/** Tiny Web Audio engine: soft chimes for session events and an optional brown-noise ambient bed. */

export type Cue = 'reveal' | 'success' | 'fail' | 'complete' | 'tick' | 'start';

type Ctor = typeof AudioContext;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private ambient: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  private context(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const C: Ctor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, at: number, dur: number, peak = 0.08, type: OscillatorType = 'sine') {
    const ctx = this.context();
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  play(cue: Cue) {
    switch (cue) {
      case 'reveal':
        this.tone(660, 0, 0.35, 0.05);
        break;
      case 'success':
        this.tone(784, 0, 0.3, 0.05);
        this.tone(1047, 0.08, 0.45, 0.04);
        break;
      case 'fail':
        this.tone(330, 0, 0.35, 0.05, 'triangle');
        this.tone(262, 0.1, 0.45, 0.04, 'triangle');
        break;
      case 'complete':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.11, 0.7, 0.045));
        break;
      case 'start':
        this.tone(440, 0, 0.5, 0.04);
        this.tone(660, 0.12, 0.6, 0.035);
        break;
      case 'tick':
        this.tone(1200, 0, 0.08, 0.02, 'square');
        break;
    }
  }

  startAmbient() {
    const ctx = this.context();
    if (!ctx || this.ambient) return;
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 2.5);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    this.ambient = { source, gain };
  }

  stopAmbient() {
    const ctx = this.ctx;
    const amb = this.ambient;
    if (!ctx || !amb) return;
    this.ambient = null;
    amb.gain.gain.cancelScheduledValues(ctx.currentTime);
    amb.gain.gain.setValueAtTime(Math.max(amb.gain.gain.value, 0.0001), ctx.currentTime);
    amb.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    amb.source.stop(ctx.currentTime + 0.9);
  }
}

export const audio = new AudioEngine();
