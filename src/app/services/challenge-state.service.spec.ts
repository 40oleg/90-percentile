import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ChallengeStateService } from './challenge-state.service';

describe('ChallengeStateService', () => {
  let service: ChallengeStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ChallengeStateService);
  });

  it('starts with nothing completed', () => {
    expect(service.completedCount()).toBe(0);
    expect(service.percentile()).toBe(0);
  });

  it('exposes the same total as the challenge list length', () => {
    expect(service.total).toBe(service.challenges.length);
  });

  it('toggle() marks a challenge completed and updates derived state', () => {
    const id = service.challenges[0].id;

    service.toggle(id);

    expect(service.isCompleted(id)).toBe(true);
    expect(service.completedCount()).toBe(1);
    expect(service.percentile()).toBe(Math.round((1 / service.total) * 100));
  });

  it('toggle() twice reverts a challenge back to incomplete', () => {
    const id = service.challenges[0].id;

    service.toggle(id);
    service.toggle(id);

    expect(service.isCompleted(id)).toBe(false);
    expect(service.completedCount()).toBe(0);
  });

  it('toggling one challenge does not affect others', () => {
    const [first, second] = service.challenges;

    service.toggle(first.id);

    expect(service.isCompleted(first.id)).toBe(true);
    expect(service.isCompleted(second.id)).toBe(false);
  });

  it('persists completed ids to localStorage', () => {
    const id = service.challenges[0].id;

    service.toggle(id);
    TestBed.flushEffects();

    const stored = JSON.parse(localStorage.getItem('90percentile.completed') ?? '[]');
    expect(stored).toContain(id);
  });

  it('hydrates completed ids from localStorage on construction', () => {
    const id = service.challenges[1].id;
    localStorage.setItem('90percentile.completed', JSON.stringify([id]));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(ChallengeStateService);

    expect(fresh.isCompleted(id)).toBe(true);
    expect(fresh.completedCount()).toBe(1);
  });

  it('ignores corrupted localStorage content and starts empty', () => {
    localStorage.setItem('90percentile.completed', '{not valid json');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(ChallengeStateService);

    expect(fresh.completedCount()).toBe(0);
  });

  describe('filter', () => {
    it('defaults to "all"', () => {
      expect(service.filter()).toBe('all');
      expect(service.visibleChallenges().length).toBe(service.total);
    });

    it('"completed" shows only completed challenges', () => {
      const id = service.challenges[0].id;
      service.toggle(id);

      service.setFilter('completed');

      const visible = service.visibleChallenges();
      expect(visible.length).toBe(1);
      expect(visible[0].id).toBe(id);
    });

    it('"incomplete" excludes completed challenges', () => {
      const id = service.challenges[0].id;
      service.toggle(id);

      service.setFilter('incomplete');

      const visible = service.visibleChallenges();
      expect(visible.length).toBe(service.total - 1);
      expect(visible.some((c) => c.id === id)).toBe(false);
    });

    it('switching back to "all" restores the full list', () => {
      service.toggle(service.challenges[0].id);
      service.setFilter('completed');
      service.setFilter('all');

      expect(service.visibleChallenges().length).toBe(service.total);
    });
  });
});
