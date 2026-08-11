import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AVERAGE_DAYS,
  CALORIE_NORM,
  CalorieService,
  MAX_ENTRY_KCAL,
  startOfDay,
} from './calorie.service';

const KEY = '90percentile.calories';

/** Local noon on a day `offset` days from today — noon keeps DST out of the math. */
function dayAt(offset: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function storedEntries(): { id: string; kcal: number; at: string }[] {
  return JSON.parse(localStorage.getItem(KEY) ?? '[]');
}

describe('CalorieService', () => {
  let service: CalorieService;

  function freshService(): CalorieService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(CalorieService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalorieService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('defaults', () => {
    it('starts with an empty log', () => {
      expect(service.entries()).toEqual([]);
      expect(service.entryCount()).toBe(0);
    });

    it('reports a zero average, total and day count with no entries', () => {
      expect(service.dailyAverage()).toBe(0);
      expect(service.totalKcal()).toBe(0);
      expect(service.daysTracked()).toBe(0);
      expect(service.todayKcal()).toBe(0);
    });

    it('is not over the norm when nothing is logged', () => {
      expect(service.overNorm()).toBe(false);
    });

    it('exposes the 2200 kcal norm', () => {
      expect(CALORIE_NORM).toBe(2200);
      expect(service.norm).toBe(2200);
    });
  });

  describe('add()', () => {
    it('records an entry with the given kcal', () => {
      expect(service.add(1000)).toBe(true);

      expect(service.entries()).toHaveLength(1);
      expect(service.entries()[0].kcal).toBe(1000);
    });

    it('stamps the entry with the time it was logged', () => {
      const before = Date.now();
      service.add(500);
      const at = Date.parse(service.entries()[0].at);

      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(Date.now());
    });

    it('gives every entry its own id', () => {
      service.add(100);
      service.add(100);
      service.add(100);

      const ids = new Set(service.entries().map((e) => e.id));
      expect(ids.size).toBe(3);
    });

    it('keeps the newest entry first', () => {
      service.add(100);
      service.add(200);

      expect(service.entries().map((e) => e.kcal)).toEqual([200, 100]);
    });

    it('rounds fractional kcal', () => {
      service.add(123.6);

      expect(service.entries()[0].kcal).toBe(124);
    });

    it.each([0, -1, -1000, Number.NaN, Number.POSITIVE_INFINITY, MAX_ENTRY_KCAL + 1])(
      'rejects %p',
      (value) => {
        expect(service.add(value)).toBe(false);
        expect(service.entries()).toHaveLength(0);
      },
    );

    it('accepts exactly the maximum entry size', () => {
      expect(service.add(MAX_ENTRY_KCAL)).toBe(true);
    });

    it('accepts an explicit timestamp', () => {
      const at = dayAt(-3);
      service.add(700, at);

      expect(service.entries()[0].at).toBe(at.toISOString());
    });
  });

  describe('daily average', () => {
    it('equals the entry itself on the first day', () => {
      service.add(5000);

      expect(service.daysTracked()).toBe(1);
      expect(service.dailyAverage()).toBe(5000);
    });

    it('sums several entries made on the same day', () => {
      service.add(1000);
      service.add(1200);

      expect(service.totalKcal()).toBe(2200);
      expect(service.daysTracked()).toBe(1);
      expect(service.dailyAverage()).toBe(2200);
    });

    it('halves after a day with nothing logged', () => {
      service.add(5000, dayAt(-1));

      expect(service.daysTracked()).toBe(2);
      expect(service.dailyAverage()).toBe(2500);
    });

    it('spreads the total over the whole tracked span, empty days included', () => {
      service.add(3000, dayAt(-9));

      expect(service.daysTracked()).toBe(10);
      expect(service.dailyAverage()).toBe(300);
    });

    it('counts the span from the earliest entry, not the most recent one', () => {
      service.add(1000, dayAt(-1));
      service.add(1000, dayAt(-4));

      expect(service.daysTracked()).toBe(5);
      expect(service.dailyAverage()).toBe(400);
    });

    it('rounds the average to a whole number', () => {
      service.add(1000, dayAt(-2));

      expect(service.dailyAverage()).toBe(333);
    });

    it('never counts fewer than one day, even for a future-dated entry', () => {
      service.add(1000, dayAt(3));

      expect(service.daysTracked()).toBe(1);
      expect(service.dailyAverage()).toBe(1000);
    });

    it('drops back to zero once the last entry is removed', () => {
      service.add(2000);
      service.remove(service.entries()[0].id);

      expect(service.dailyAverage()).toBe(0);
      expect(service.daysTracked()).toBe(0);
    });
  });

  describe('four-week window', () => {
    it('spreads the average over four weeks at most', () => {
      expect(AVERAGE_DAYS).toBe(28);

      service.add(2800, dayAt(-100));
      service.add(2800, dayAt(0));

      // 100 days tracked, but only the last 28 count — and only today's entry
      // falls inside them.
      expect(service.daysTracked()).toBe(101);
      expect(service.averageDays()).toBe(28);
      expect(service.dailyAverage()).toBe(100);
    });

    it('ignores intakes older than the window', () => {
      service.add(50_000, dayAt(-AVERAGE_DAYS));
      service.add(2800, dayAt(0));

      expect(service.windowKcal()).toBe(2800);
      expect(service.dailyAverage()).toBe(100);
    });

    it('counts the oldest day still inside the window', () => {
      service.add(2800, dayAt(-(AVERAGE_DAYS - 1)));

      expect(service.windowKcal()).toBe(2800);
      expect(service.averageDays()).toBe(28);
      expect(service.dailyAverage()).toBe(100);
    });

    it('keeps every entry in the log however old it is', () => {
      service.add(1000, dayAt(-400));
      service.add(1000, dayAt(0));

      expect(service.entries()).toHaveLength(2);
      expect(service.entryCount()).toBe(2);
      expect(service.totalKcal()).toBe(2000);
    });

    it('still averages over the tracked days while the log is younger', () => {
      service.add(3000, dayAt(-1));

      expect(service.averageDays()).toBe(2);
      expect(service.dailyAverage()).toBe(1500);
    });

    it('drops out of the window as the days roll past', () => {
      service.add(2800, dayAt(-(AVERAGE_DAYS - 1)));
      expect(service.dailyAverage()).toBe(100);

      vi.useFakeTimers();
      vi.setSystemTime(dayAt(1));
      service.syncToday();

      expect(service.windowKcal()).toBe(0);
      expect(service.dailyAverage()).toBe(0);
      expect(service.entries()).toHaveLength(1);
    });
  });

  describe('norm', () => {
    it('is within norm at exactly 2200 per day', () => {
      service.add(CALORIE_NORM);

      expect(service.dailyAverage()).toBe(2200);
      expect(service.overNorm()).toBe(false);
    });

    it('is over the norm one kcal above it', () => {
      service.add(CALORIE_NORM + 1);

      expect(service.overNorm()).toBe(true);
    });

    it('falls back within norm as untracked days accumulate', () => {
      service.add(3000, dayAt(-1));

      expect(service.dailyAverage()).toBe(1500);
      expect(service.overNorm()).toBe(false);
    });
  });

  describe('todayKcal', () => {
    it('counts only entries logged today', () => {
      service.add(800);
      service.add(400);
      service.add(9000, dayAt(-1));

      expect(service.todayKcal()).toBe(1200);
    });

    it('is zero when everything was logged on earlier days', () => {
      service.add(1500, dayAt(-2));

      expect(service.todayKcal()).toBe(0);
    });
  });

  describe('remove() / clear()', () => {
    it('removes only the entry with the given id', () => {
      service.add(100);
      service.add(200);
      const target = service.entries().find((e) => e.kcal === 100)!;

      service.remove(target.id);

      expect(service.entries().map((e) => e.kcal)).toEqual([200]);
    });

    it('ignores an unknown id', () => {
      service.add(100);
      service.remove('nope');

      expect(service.entries()).toHaveLength(1);
    });

    it('updates the total after a removal', () => {
      service.add(1000);
      service.add(1000);
      service.remove(service.entries()[0].id);

      expect(service.totalKcal()).toBe(1000);
    });

    it('clear() empties the log', () => {
      service.add(100);
      service.add(200);
      service.clear();

      expect(service.entries()).toEqual([]);
      expect(service.totalKcal()).toBe(0);
    });
  });

  describe('persistence', () => {
    it('writes entries to localStorage', () => {
      service.add(1234);
      TestBed.tick();

      expect(storedEntries()).toHaveLength(1);
      expect(storedEntries()[0].kcal).toBe(1234);
    });

    it('reloads entries on a fresh start', () => {
      service.add(700, dayAt(-1));
      service.add(300);
      TestBed.tick();

      const fresh = freshService();

      expect(fresh.entries()).toHaveLength(2);
      expect(fresh.totalKcal()).toBe(1000);
      expect(fresh.daysTracked()).toBe(2);
      expect(fresh.dailyAverage()).toBe(500);
    });

    it('keeps a removal persisted', () => {
      service.add(100);
      service.add(200);
      service.remove(service.entries()[0].id);
      TestBed.tick();

      expect(freshService().entries()).toHaveLength(1);
    });

    it('never rotates or trims history', () => {
      for (let i = 0; i < 500; i++) service.add(10, dayAt(-i));
      TestBed.tick();

      expect(freshService().entries()).toHaveLength(500);
    });

    it('sorts reloaded entries newest first', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([
          { id: 'a', kcal: 100, at: dayAt(-5).toISOString() },
          { id: 'b', kcal: 200, at: dayAt(0).toISOString() },
          { id: 'c', kcal: 300, at: dayAt(-2).toISOString() },
        ]),
      );

      expect(
        freshService()
          .entries()
          .map((e) => e.id),
      ).toEqual(['b', 'c', 'a']);
    });

    it('ignores malformed JSON', () => {
      localStorage.setItem(KEY, '{not json');

      expect(freshService().entries()).toEqual([]);
    });

    it('ignores a non-array payload', () => {
      localStorage.setItem(KEY, '{"kcal":100}');

      expect(freshService().entries()).toEqual([]);
    });

    it('drops entries with a missing or invalid shape', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([
          { id: 'ok', kcal: 100, at: dayAt(0).toISOString() },
          { id: 'no-kcal', at: dayAt(0).toISOString() },
          { id: 'bad-kcal', kcal: 'lots', at: dayAt(0).toISOString() },
          { id: 'negative', kcal: -5, at: dayAt(0).toISOString() },
          { kcal: 100, at: dayAt(0).toISOString() },
          { id: 'bad-date', kcal: 100, at: 'yesterday-ish' },
          null,
          'nope',
        ]),
      );

      const fresh = freshService();
      expect(fresh.entries().map((e) => e.id)).toEqual(['ok']);
      expect(fresh.totalKcal()).toBe(100);
    });

    it('survives localStorage.setItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });

      const fresh = freshService();
      expect(() => {
        fresh.add(100);
        TestBed.tick();
      }).not.toThrow();
      expect(fresh.entries()).toHaveLength(1);

      spy.mockRestore();
    });

    it('survives localStorage.getItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });

      expect(freshService().entries()).toEqual([]);
      spy.mockRestore();
    });
  });

  describe('day rollover', () => {
    it('startOfDay() strips the time part', () => {
      const midday = new Date(2026, 6, 15, 13, 45, 30, 500);

      expect(startOfDay(midday)).toBe(new Date(2026, 6, 15).getTime());
    });

    it('syncToday() halves the average once the date has rolled over', () => {
      vi.useFakeTimers();
      const start = new Date(2026, 6, 15, 22, 0, 0);
      vi.setSystemTime(start);

      const fresh = freshService();
      fresh.add(5000);
      expect(fresh.dailyAverage()).toBe(5000);

      vi.setSystemTime(new Date(2026, 6, 16, 9, 0, 0));
      fresh.syncToday();

      expect(fresh.daysTracked()).toBe(2);
      expect(fresh.dailyAverage()).toBe(2500);
      expect(fresh.todayKcal()).toBe(0);
    });

    it('rolls the day over on its own timer without any user action', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 6, 15, 23, 59, 0));

      const fresh = freshService();
      fresh.add(4400);
      expect(fresh.dailyAverage()).toBe(4400);

      vi.setSystemTime(new Date(2026, 6, 16, 0, 1, 0));
      vi.advanceTimersByTime(60_000);

      expect(fresh.dailyAverage()).toBe(2200);
      expect(fresh.overNorm()).toBe(false);
    });

    it('stops its timer when the injector is destroyed', () => {
      vi.useFakeTimers();
      const clearSpy = vi.spyOn(globalThis, 'clearInterval');

      freshService();
      TestBed.resetTestingModule();

      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
