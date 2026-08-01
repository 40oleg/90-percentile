import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHART_ATTEMPTS, MAX_STORED_ATTEMPTS, QuizService, TARGET_PERCENT } from './quiz.service';
import { QuizAttempt } from '../models/quiz.model';

const ATTEMPTS_KEY = '90percentile.quiz.attempts';
const TOPIC_KEY = '90percentile.quiz.topic';

function storedAttempts(): QuizAttempt[] {
  return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '[]');
}

function attempt(overrides: Partial<QuizAttempt> = {}): QuizAttempt {
  return {
    id: `a-${Math.random().toString(36).slice(2)}`,
    topicId: 'angular',
    correct: 10,
    total: 15,
    at: new Date().toISOString(),
    ...overrides,
  };
}

describe('QuizService', () => {
  let service: QuizService;

  function freshService(): QuizService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(QuizService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuizService);
  });

  describe('defaults', () => {
    it('starts without attempts', () => {
      expect(service.attempts()).toEqual([]);
      expect(service.totalAttempts()).toBe(0);
    });

    it('selects the first registered topic', () => {
      expect(service.topicId()).toBe('angular');
    });

    it('draws 90 attempts on the chart and targets 90%', () => {
      expect(CHART_ATTEMPTS).toBe(90);
      expect(TARGET_PERCENT).toBe(90);
    });

    it('reports empty stats for a topic with no history', () => {
      expect(service.statsFor('angular')).toEqual({
        attempts: 0,
        last: null,
        best: 0,
        average: 0,
        onTarget: 0,
      });
    });
  });

  describe('record()', () => {
    it('stores an attempt', () => {
      const stored = service.record('angular', 12, 15);

      expect(stored).not.toBeNull();
      expect(service.attempts()).toHaveLength(1);
      expect(service.attempts()[0]).toMatchObject({ topicId: 'angular', correct: 12, total: 15 });
    });

    it('keeps the newest attempt first', () => {
      service.record('angular', 1, 15);
      service.record('angular', 2, 15);

      expect(service.attempts().map((a) => a.correct)).toEqual([2, 1]);
    });

    it('gives every attempt its own id', () => {
      service.record('angular', 1, 15);
      service.record('angular', 2, 15);
      service.record('angular', 3, 15);

      expect(new Set(service.attempts().map((a) => a.id)).size).toBe(3);
    });

    it('stamps the attempt with the finish time', () => {
      const before = Date.now();
      service.record('angular', 5, 15);
      const at = Date.parse(service.attempts()[0].at);

      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(Date.now());
    });

    it('accepts an explicit timestamp', () => {
      const at = new Date('2026-01-02T03:04:05.000Z');
      service.record('angular', 5, 15, at);

      expect(service.attempts()[0].at).toBe(at.toISOString());
    });

    it('accepts a perfect and a zero score', () => {
      expect(service.record('angular', 15, 15)).not.toBeNull();
      expect(service.record('angular', 0, 15)).not.toBeNull();
      expect(service.attempts()).toHaveLength(2);
    });

    it.each([
      ['more correct than asked', 16, 15],
      ['a negative score', -1, 15],
      ['an empty run', 0, 0],
      ['a fractional score', 1.5, 15],
      ['a fractional total', 10, 15.5],
      ['NaN', Number.NaN, 15],
    ])('rejects %s', (_label, correct, total) => {
      expect(service.record('angular', correct, total)).toBeNull();
      expect(service.attempts()).toHaveLength(0);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      // 60%, 80%, 100% — recorded oldest first.
      service.record('angular', 9, 15);
      service.record('angular', 12, 15);
      service.record('angular', 15, 15);
    });

    it('counts the attempts of the topic', () => {
      expect(service.statsFor('angular').attempts).toBe(3);
    });

    it('reports the most recent percent as last', () => {
      expect(service.statsFor('angular').last).toBe(100);
    });

    it('reports the best percent', () => {
      expect(service.statsFor('angular').best).toBe(100);
    });

    it('averages the percents', () => {
      expect(service.statsFor('angular').average).toBe(80);
    });

    it('counts runs that reached the target', () => {
      expect(service.statsFor('angular').onTarget).toBe(1);
    });

    it('keeps topics apart', () => {
      service.record('rxjs', 3, 15);

      expect(service.statsFor('angular').attempts).toBe(3);
      expect(service.statsFor('rxjs').attempts).toBe(1);
      expect(service.statsFor('rxjs').best).toBe(20);
    });

    it('rounds the average to a whole percent', () => {
      const fresh = freshService();
      fresh.record('angular', 1, 3); // 33%
      fresh.record('angular', 2, 3); // 67%

      expect(fresh.statsFor('angular').average).toBe(50);
    });
  });

  describe('recentFor()', () => {
    it('returns attempts oldest first', () => {
      service.record('angular', 1, 15);
      service.record('angular', 2, 15);
      service.record('angular', 3, 15);

      expect(service.recentFor('angular').map((a) => a.correct)).toEqual([1, 2, 3]);
    });

    it('caps the window at the last 90 attempts', () => {
      for (let i = 0; i < 120; i++) service.record('angular', i % 16, 15);

      const recent = service.recentFor('angular');
      expect(recent).toHaveLength(CHART_ATTEMPTS);
      // The oldest 30 runs fell out of the window.
      expect(recent[0].correct).toBe(30 % 16);
      expect(recent[recent.length - 1].correct).toBe(119 % 16);
    });

    it('accepts a custom window', () => {
      for (let i = 0; i < 10; i++) service.record('angular', i, 15);

      expect(service.recentFor('angular', 3).map((a) => a.correct)).toEqual([7, 8, 9]);
    });

    it('ignores attempts of other topics', () => {
      service.record('angular', 1, 15);
      service.record('rxjs', 2, 15);

      expect(service.recentFor('angular')).toHaveLength(1);
    });
  });

  describe('topic selection', () => {
    it('remembers the selected topic', () => {
      service.selectTopic('rxjs');
      TestBed.tick();

      expect(localStorage.getItem(TOPIC_KEY)).toBe('rxjs');
    });

    it('falls back to the first topic when the stored one is unknown', () => {
      localStorage.setItem(TOPIC_KEY, 'deleted-topic');

      expect(freshService().topicId()).toBe('angular');
    });

    it('restores a known stored topic', () => {
      localStorage.setItem(TOPIC_KEY, 'angular');

      expect(freshService().topicId()).toBe('angular');
    });
  });

  describe('clearing', () => {
    beforeEach(() => {
      service.record('angular', 5, 15);
      service.record('rxjs', 6, 15);
    });

    it('clears one topic and leaves the others alone', () => {
      service.clearTopic('angular');

      expect(service.statsFor('angular').attempts).toBe(0);
      expect(service.statsFor('rxjs').attempts).toBe(1);
    });

    it('clears everything', () => {
      service.clearAll();

      expect(service.attempts()).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('writes attempts to localStorage', () => {
      service.record('angular', 11, 15);
      TestBed.tick();

      expect(storedAttempts()).toHaveLength(1);
      expect(storedAttempts()[0].correct).toBe(11);
    });

    it('reloads the history on the next launch', () => {
      service.record('angular', 11, 15);
      TestBed.tick();

      expect(freshService().statsFor('angular').last).toBe(73);
    });

    it('sorts a shuffled stored history newest first', () => {
      const older = attempt({ correct: 1, at: '2026-01-01T10:00:00.000Z' });
      const newer = attempt({ correct: 2, at: '2026-02-01T10:00:00.000Z' });
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify([older, newer]));

      expect(
        freshService()
          .attempts()
          .map((a) => a.correct),
      ).toEqual([2, 1]);
    });

    it.each([
      ['not JSON', 'oops'],
      ['not an array', '{"correct":1}'],
    ])('survives stored data that is %s', (_label, raw) => {
      localStorage.setItem(ATTEMPTS_KEY, raw);

      expect(freshService().attempts()).toEqual([]);
    });

    it('drops individual corrupt attempts but keeps the good ones', () => {
      localStorage.setItem(
        ATTEMPTS_KEY,
        JSON.stringify([
          attempt({ correct: 7 }),
          { id: 'x', topicId: 'angular' },
          attempt({ correct: 20, total: 15 }),
          attempt({ at: 'not-a-date' }),
          null,
        ]),
      );

      const restored = freshService().attempts();
      expect(restored).toHaveLength(1);
      expect(restored[0].correct).toBe(7);
    });

    it('keeps at most MAX_STORED_ATTEMPTS per topic', () => {
      for (let i = 0; i < MAX_STORED_ATTEMPTS + 25; i++) service.record('angular', 1, 15);
      service.record('rxjs', 1, 15);

      expect(service.attemptsFor('angular')).toHaveLength(MAX_STORED_ATTEMPTS);
      expect(service.attemptsFor('rxjs')).toHaveLength(1);
    });

    it('trims an oversized stored history on load', () => {
      const many = Array.from({ length: MAX_STORED_ATTEMPTS + 10 }, (_, i) =>
        attempt({ at: new Date(2026, 0, 1, 0, i).toISOString() }),
      );
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(many));

      expect(freshService().attemptsFor('angular')).toHaveLength(MAX_STORED_ATTEMPTS);
    });
  });
});
