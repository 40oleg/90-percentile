import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEIGHT_LIMITS, WeightService, startOfDay } from './weight.service';
import { WeightEntry } from '../models/weight-entry.model';

const KEY = '90percentile.weight';
const RANGE_KEY = '90percentile.weight.range';

/** Local noon `offset` days from today — noon keeps DST out of the math. */
function dayAt(offset: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function storedEntries(): WeightEntry[] {
  return JSON.parse(localStorage.getItem(KEY) ?? '[]');
}

describe('WeightService', () => {
  let service: WeightService;

  function freshService(): WeightService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(WeightService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(WeightService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('defaults', () => {
    it('starts with an empty diary', () => {
      expect(service.entries()).toEqual([]);
      expect(service.count()).toBe(0);
      expect(service.currentKg()).toBeNull();
      expect(service.latest()).toBeNull();
    });

    it('has no series and no statistics', () => {
      expect(service.series()).toEqual([]);
      expect(service.change()).toBeNull();
      expect(service.minKg()).toBeNull();
      expect(service.maxKg()).toBeNull();
    });

    it('opens on the one-month range', () => {
      expect(service.rangeId()).toBe('month');
      expect(service.range().days).toBe(30);
    });
  });

  describe('add()', () => {
    it('records a weigh-in', () => {
      expect(service.add(74.5)).toBe(true);

      expect(service.entries()).toHaveLength(1);
      expect(service.entries()[0].kg).toBe(74.5);
      expect(service.currentKg()).toBe(74.5);
    });

    it('stamps the weigh-in with the time it was recorded', () => {
      const before = Date.now();
      service.add(74.5);
      const at = Date.parse(service.entries()[0].at);

      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(Date.now());
    });

    it('gives every weigh-in its own id', () => {
      service.add(74.5);
      service.add(74.6);

      const [a, b] = service.entries();
      expect(a.id).not.toBe(b.id);
    });

    it('rounds to one decimal', () => {
      service.add(74.449);

      expect(service.entries()[0].kg).toBe(74.4);
    });

    it('keeps the newest weigh-in first', () => {
      service.add(80, dayAt(-2));
      service.add(79, dayAt(-1));

      expect(service.entries()[0].kg).toBe(79);
      expect(service.currentKg()).toBe(79);
    });

    it('rejects a weight below the limit', () => {
      expect(service.add(WEIGHT_LIMITS.min - 0.1)).toBe(false);
      expect(service.entries()).toEqual([]);
    });

    it('rejects a weight above the limit', () => {
      expect(service.add(WEIGHT_LIMITS.max + 0.1)).toBe(false);
    });

    it('accepts the weights at the very edge of the limits', () => {
      expect(service.add(WEIGHT_LIMITS.min)).toBe(true);
      expect(service.add(WEIGHT_LIMITS.max)).toBe(true);
    });

    it('rejects values that are not numbers', () => {
      expect(service.add(Number.NaN)).toBe(false);
      expect(service.add(Number.POSITIVE_INFINITY)).toBe(false);
      expect(service.add(0)).toBe(false);
      expect(service.add(-74)).toBe(false);
    });

    it('rejects an invalid timestamp', () => {
      expect(service.add(74.5, new Date('nonsense'))).toBe(false);
      expect(service.entries()).toEqual([]);
    });
  });

  describe('remove() and clear()', () => {
    it('drops a single weigh-in by id', () => {
      service.add(74.5);
      service.add(75);
      const id = service.entries()[0].id;

      service.remove(id);

      expect(service.entries()).toHaveLength(1);
      expect(service.entries()[0].id).not.toBe(id);
    });

    it('wipes the diary', () => {
      service.add(74.5);
      service.clear();

      expect(service.entries()).toEqual([]);
      expect(service.currentKg()).toBeNull();
    });
  });

  describe('persistence', () => {
    it('writes weigh-ins to localStorage', () => {
      service.add(74.5);
      TestBed.tick();

      expect(storedEntries()).toHaveLength(1);
      expect(storedEntries()[0].kg).toBe(74.5);
    });

    it('restores weigh-ins on a fresh start', () => {
      service.add(74.5, dayAt(-1));
      TestBed.tick();

      expect(freshService().entries()).toHaveLength(1);
    });

    it('never rotates old weigh-ins out', () => {
      service.add(90, dayAt(-400));
      service.add(74.5, dayAt(0));
      TestBed.tick();

      const restored = freshService();
      expect(restored.entries()).toHaveLength(2);
      expect(restored.count()).toBe(2);
      // Long outside the half-year window, so it shapes no chart.
      expect(restored.series()).toHaveLength(1);
    });

    it('sorts restored weigh-ins newest first', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([
          { id: 'old', kg: 80, at: dayAt(-3).toISOString() },
          { id: 'new', kg: 79, at: dayAt(-1).toISOString() },
        ]),
      );

      expect(freshService().entries()[0].id).toBe('new');
    });

    it('drops malformed records', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([
          { id: 'ok', kg: 74.5, at: new Date().toISOString() },
          { id: 'no-kg', at: new Date().toISOString() },
          { id: 'bad-date', kg: 74.5, at: 'yesterday' },
          { kg: 74.5, at: new Date().toISOString() },
          'junk',
          null,
        ]),
      );

      const restored = freshService();
      expect(restored.entries()).toHaveLength(1);
      expect(restored.entries()[0].id).toBe('ok');
    });

    it('survives unparsable storage', () => {
      localStorage.setItem(KEY, '{oops');

      expect(freshService().entries()).toEqual([]);
    });

    it('survives localStorage.getItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });

      const fresh = freshService();
      expect(fresh.entries()).toEqual([]);
      expect(fresh.rangeId()).toBe('month');
      spy.mockRestore();
    });

    it('survives localStorage.setItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });

      const fresh = freshService();
      expect(() => {
        fresh.add(74.5);
        TestBed.tick();
      }).not.toThrow();
      expect(fresh.entries()).toHaveLength(1);

      spy.mockRestore();
    });
  });

  describe('range', () => {
    it('switches the charted stretch', () => {
      service.selectRange('half');

      expect(service.rangeId()).toBe('half');
      expect(service.range().days).toBe(180);
    });

    it('remembers the range across launches', () => {
      service.selectRange('quarter');
      TestBed.tick();

      expect(localStorage.getItem(RANGE_KEY)).toBe('quarter');
      expect(freshService().rangeId()).toBe('quarter');
    });

    it('falls back to a month for an unknown stored range', () => {
      localStorage.setItem(RANGE_KEY, 'decade');

      expect(freshService().rangeId()).toBe('month');
    });

    it('moves the window start with the range', () => {
      const today = startOfDay(new Date());
      const daysBack = (from: number) => Math.round((today - from) / 86_400_000);

      expect(daysBack(service.windowFrom())).toBe(29);
      service.selectRange('quarter');
      expect(daysBack(service.windowFrom())).toBe(89);
      service.selectRange('half');
      expect(daysBack(service.windowFrom())).toBe(179);
    });
  });

  describe('series', () => {
    it('holds one point per measured day, oldest first', () => {
      service.add(80, dayAt(-2));
      service.add(79, dayAt(-1));
      service.add(78, dayAt(0));

      expect(service.series().map((p) => p.kg)).toEqual([80, 79, 78]);
      expect(service.series()[0].dayStart).toBeLessThan(service.series()[2].dayStart);
    });

    it('averages several weigh-ins made on the same day', () => {
      service.add(80, dayAt(-1));
      service.add(81, dayAt(-1));

      expect(service.series()).toHaveLength(1);
      expect(service.series()[0]).toMatchObject({ kg: 80.5, count: 2 });
    });

    it('labels the days as DD.MM', () => {
      service.add(80, dayAt(0));
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');

      expect(service.series()[0].label).toBe(`${dd}.${mm}`);
    });

    it('leaves out weigh-ins older than the chosen range', () => {
      service.add(90, dayAt(-45));
      service.add(80, dayAt(-1));

      expect(service.series().map((p) => p.kg)).toEqual([80]);

      service.selectRange('quarter');
      expect(service.series().map((p) => p.kg)).toEqual([90, 80]);
    });

    it('keeps the oldest day still inside the window', () => {
      service.add(90, dayAt(-29));

      expect(service.series()).toHaveLength(1);
    });

    it('drops the day that just fell out of the window', () => {
      service.add(90, dayAt(-30));

      expect(service.series()).toEqual([]);
      expect(service.entries()).toHaveLength(1);
    });
  });

  describe('statistics', () => {
    it('reports the change across the window', () => {
      service.add(80, dayAt(-10));
      service.add(77.5, dayAt(0));

      expect(service.change()).toBe(-2.5);
      expect(service.firstKg()).toBe(80);
    });

    it('reports a gain as a positive change', () => {
      service.add(75, dayAt(-10));
      service.add(76.2, dayAt(0));

      expect(service.change()).toBe(1.2);
    });

    it('has no change to report from a single weigh-in', () => {
      service.add(80);

      expect(service.change()).toBeNull();
    });

    it('reports the lightest and the heaviest day of the window', () => {
      service.add(80, dayAt(-5));
      service.add(77, dayAt(-3));
      service.add(82, dayAt(-1));

      expect(service.minKg()).toBe(77);
      expect(service.maxKg()).toBe(82);
    });

    it('follows the selected range', () => {
      service.add(95, dayAt(-60));
      service.add(80, dayAt(-1));

      expect(service.maxKg()).toBe(80);

      service.selectRange('quarter');
      expect(service.maxKg()).toBe(95);
      expect(service.change()).toBe(-15);
    });

    it('keeps the current weight outside the window', () => {
      service.add(95, dayAt(-100));

      expect(service.currentKg()).toBe(95);
      expect(service.series()).toEqual([]);
    });
  });

  describe('syncToday()', () => {
    it('rolls the window over once the date changes', () => {
      service.add(80, dayAt(-29));
      expect(service.series()).toHaveLength(1);

      vi.useFakeTimers();
      vi.setSystemTime(dayAt(1));
      service.syncToday();

      expect(service.series()).toEqual([]);
      expect(service.entries()).toHaveLength(1);
    });
  });
});
