import { Injectable, signal } from '@angular/core';

const MUTE_KEY = '90percentile.muted';

/** Tiny synthesized 8-bit SFX via WebAudio — no audio assets to fetch/cache. */
@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly muted = signal<boolean>(localStorage.getItem(MUTE_KEY) === '1');

  private ctx: AudioContext | null = null;

  toggleMuted(): void {
    const next = !this.muted();
    this.muted.set(next);
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
    if (!next) this.playClick();
  }

  /** Rising two-note arpeggio — challenge marked complete. */
  playComplete(): void {
    this.playNotes([
      { freq: 523.25, start: 0, dur: 0.07 },
      { freq: 659.25, start: 0.07, dur: 0.07 },
      { freq: 783.99, start: 0.14, dur: 0.12 },
    ]);
  }

  /** Short descending blip — challenge reverted to incomplete. */
  playUndo(): void {
    this.playNotes([
      { freq: 392.0, start: 0, dur: 0.06 },
      { freq: 261.63, start: 0.06, dur: 0.09 },
    ]);
  }

  /** Neutral UI blip for filter switches / mute toggle. */
  playClick(): void {
    this.playNotes([{ freq: 440, start: 0, dur: 0.04 }]);
  }

  private playNotes(notes: { freq: number; start: number; dur: number }[]): void {
    if (this.muted()) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = note.freq;

      const t0 = now + note.start;
      const t1 = t0 + note.dur;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }
}
