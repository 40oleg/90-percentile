import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SoundService } from './sound.service';

describe('SoundService', () => {
  let service: SoundService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SoundService);
  });

  it('starts unmuted by default', () => {
    expect(service.muted()).toBe(false);
  });

  it('hydrates the muted flag from localStorage', () => {
    localStorage.setItem('90percentile.muted', '1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(SoundService);

    expect(fresh.muted()).toBe(true);
  });

  it('toggleMuted() flips the signal', () => {
    service.toggleMuted();
    expect(service.muted()).toBe(true);

    service.toggleMuted();
    expect(service.muted()).toBe(false);
  });

  it('toggleMuted() persists the new value to localStorage', () => {
    service.toggleMuted();
    expect(localStorage.getItem('90percentile.muted')).toBe('1');

    service.toggleMuted();
    expect(localStorage.getItem('90percentile.muted')).toBe('0');
  });

  it('playComplete/playUndo/playClick never throw, even without WebAudio support', () => {
    expect(() => service.playComplete()).not.toThrow();
    expect(() => service.playUndo()).not.toThrow();
    expect(() => service.playClick()).not.toThrow();
  });

  it('playAdd/playWarn never throw, even without WebAudio support', () => {
    expect(() => service.playAdd()).not.toThrow();
    expect(() => service.playWarn()).not.toThrow();
  });

  it('does not attempt playback while muted', () => {
    service.toggleMuted();
    expect(service.muted()).toBe(true);
    expect(() => service.playComplete()).not.toThrow();
    expect(() => service.playAdd()).not.toThrow();
    expect(() => service.playWarn()).not.toThrow();
  });
});
