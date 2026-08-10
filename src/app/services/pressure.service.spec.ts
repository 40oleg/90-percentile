import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHART_DAYS, PRESSURE_LIMITS, PressureService, startOfDay } from './pressure.service';
import { PressureEntry } from '../models/pressure-entry.model';

const KEY = '90percentile.pressure';

/** `offset` days from today at a given local hour — the hour picks the slot. */
function dayAt(offset: number, hour: number): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

function storedEntries(): PressureEntry[] {
  return JSON.parse(localStorage.getItem(KEY) ?? '[]');
}

describe('PressureService', () => {
  let service: PressureService;

  function freshService(): PressureService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(PressureService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PressureService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('defaults', () => {
    it('starts with an empty diary', () => {
      expect(service.entries()).toEqual([]);
      expect(service.count()).toBe(0);
      expect(service.latest()).toBeNull();
      expect(service.daysTracked()).toBe(0);
    });

    it('has no averages and no category without readings', () => {
      expect(service.windowAverage()).toBeNull();
      expect(service.morningAverage()).toBeNull();
      expect(service.eveningAverage()).toBeNull();
      expect(service.category()).toBeNull();
    });

    it('charts two weeks', () => {
      expect(CHART_DAYS).toBe(14);
      expect(service.chartDays).toBe(14);
    });
  });

  describe('add()', () => {
    it('records a reading', () => {
      expect(service.add(120, 80, 65)).toBe(true);

      const entry = service.entries()[0];
      expect(entry.systolic).toBe(120);
      expect(entry.diastolic).toBe(80);
      expect(entry.pulse).toBe(65);
    });

    it('stamps the reading with the time it was taken', () => {
      const before = Date.now();
      service.add(120, 80, 65);
      const at = Date.parse(service.entries()[0].at);

      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(Date.now());
    });

    it('gives every reading its own id', () => {
      service.add(120, 80, 65);
      service.add(121, 81, 66);

      const [a, b] = service.entries();
      expect(a.id).not.toBe(b.id);
    });

    it('rounds fractional values', () => {
      service.add(120.4, 80.6, 65.5);

      expect(service.entries()[0]).toMatchObject({ systolic: 120, diastolic: 81, pulse: 66 });
    });

    it('keeps the newest reading first', () => {
      service.add(110, 70, 60, dayAt(-2, 9));
      service.add(130, 90, 80, dayAt(-1, 9));

      expect(service.entries()[0].systolic).toBe(130);
      expect(service.latest()!.systolic).toBe(130);
    });

    it('rejects a systolic below the limit', () => {
      expect(service.add(PRESSURE_LIMITS.systolic.min - 1, 40, 60)).toBe(false);
      expect(service.entries()).toEqual([]);
    });

    it('rejects a systolic above the limit', () => {
      expect(service.add(PRESSURE_LIMITS.systolic.max + 1, 80, 60)).toBe(false);
    });

    it('rejects a diastolic outside the limits', () => {
      expect(service.add(120, PRESSURE_LIMITS.diastolic.min - 1, 60)).toBe(false);
      expect(service.add(300, PRESSURE_LIMITS.diastolic.max + 1, 60)).toBe(false);
    });

    it('rejects a pulse outside the limits', () => {
      expect(service.add(120, 80, PRESSURE_LIMITS.pulse.min - 1)).toBe(false);
      expect(service.add(120, 80, PRESSURE_LIMITS.pulse.max + 1)).toBe(false);
    });

    it('rejects a lower value that is not below the upper one', () => {
      expect(service.add(120, 120, 65)).toBe(false);
      expect(service.add(120, 130, 65)).toBe(false);
      expect(service.entries()).toEqual([]);
    });

    it('rejects values that are not numbers', () => {
      expect(service.add(Number.NaN, 80, 65)).toBe(false);
      expect(service.add(120, Number.NaN, 65)).toBe(false);
      expect(service.add(120, 80, Number.POSITIVE_INFINITY)).toBe(false);
    });

    it('rejects an invalid timestamp', () => {
      expect(service.add(120, 80, 65, new Date('nonsense'))).toBe(false);
      expect(service.entries()).toEqual([]);
    });

    it('accepts the values at the very edge of the limits', () => {
      expect(
        service.add(
          PRESSURE_LIMITS.systolic.max,
          PRESSURE_LIMITS.diastolic.max,
          PRESSURE_LIMITS.pulse.min,
        ),
      ).toBe(true);
    });
  });

  describe('remove() and clear()', () => {
    it('drops a single reading by id', () => {
      service.add(120, 80, 65);
      service.add(130, 85, 70);
      const id = service.entries()[0].id;

      service.remove(id);

      expect(service.entries()).toHaveLength(1);
      expect(service.entries()[0].id).not.toBe(id);
    });

    it('ignores an unknown id', () => {
      service.add(120, 80, 65);
      service.remove('nope');

      expect(service.entries()).toHaveLength(1);
    });

    it('wipes the diary', () => {
      service.add(120, 80, 65);
      service.clear();

      expect(service.entries()).toEqual([]);
      expect(service.count()).toBe(0);
    });
  });

  describe('persistence', () => {
    it('writes readings to localStorage', () => {
      service.add(120, 80, 65);
      TestBed.tick();

      expect(storedEntries()).toHaveLength(1);
      expect(storedEntries()[0].systolic).toBe(120);
    });

    it('restores readings on a fresh start', () => {
      service.add(120, 80, 65, dayAt(-1, 9));
      TestBed.tick();

      expect(freshService().entries()).toHaveLength(1);
    });

    it('never rotates old readings out', () => {
      service.add(150, 95, 90, dayAt(-400, 9));
      service.add(120, 80, 65, dayAt(0, 9));
      TestBed.tick();

      const restored = freshService();
      expect(restored.entries()).toHaveLength(2);
      expect(restored.count()).toBe(2);
      // Well outside the two-week window, so it shapes no chart and no average.
      expect(restored.morningAverage()!.count).toBe(1);
    });

    it('sorts restored readings newest first', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([
          { id: 'old', systolic: 110, diastolic: 70, pulse: 60, at: dayAt(-3, 9).toISOString() },
          { id: 'new', systolic: 130, diastolic: 85, pulse: 70, at: dayAt(-1, 9).toISOString() },
        ]),
      );

      expect(freshService().entries()[0].id).toBe('new');
    });

    it('drops malformed records', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([
          { id: 'ok', systolic: 120, diastolic: 80, pulse: 65, at: new Date().toISOString() },
          { id: 'no-pulse', systolic: 120, diastolic: 80, at: new Date().toISOString() },
          { id: 'bad-date', systolic: 120, diastolic: 80, pulse: 65, at: 'yesterday' },
          { systolic: 120, diastolic: 80, pulse: 65, at: new Date().toISOString() },
          'junk',
          null,
        ]),
      );

      const restored = freshService();
      expect(restored.entries()).toHaveLength(1);
      expect(restored.entries()[0].id).toBe('ok');
    });

    it('survives a non-array payload', () => {
      localStorage.setItem(KEY, JSON.stringify({ systolic: 120 }));

      expect(freshService().entries()).toEqual([]);
    });

    it('survives unparsable storage', () => {
      localStorage.setItem(KEY, '{oops');

      expect(freshService().entries()).toEqual([]);
    });

    it('survives localStorage.getItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });

      expect(freshService().entries()).toEqual([]);
      spy.mockRestore();
    });

    it('survives localStorage.setItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });

      const fresh = freshService();
      expect(() => {
        fresh.add(120, 80, 65);
        TestBed.tick();
      }).not.toThrow();
      expect(fresh.entries()).toHaveLength(1);

      spy.mockRestore();
    });
  });

  describe('slots', () => {
    it('files a reading taken before noon as a morning one', () => {
      service.add(118, 76, 60, dayAt(0, 11));

      expect(service.morningAverage()).toMatchObject({ systolic: 118, count: 1 });
      expect(service.eveningAverage()).toBeNull();
    });

    it('files a reading taken at noon as an evening one', () => {
      service.add(128, 86, 72, dayAt(0, 12));

      expect(service.eveningAverage()).toMatchObject({ systolic: 128, count: 1 });
      expect(service.morningAverage()).toBeNull();
    });

    it('keeps the two slots apart on their charts', () => {
      service.add(118, 76, 60, dayAt(0, 8));
      service.add(132, 88, 74, dayAt(0, 20));

      const morning = service.morningSeries().at(-1)!;
      const evening = service.eveningSeries().at(-1)!;

      expect(morning).toMatchObject({ systolic: 118, diastolic: 76, pulse: 60 });
      expect(evening).toMatchObject({ systolic: 132, diastolic: 88, pulse: 74 });
    });

    it('reports the slot a reading logged right now would land in', () => {
      const expected = new Date().getHours() < 12 ? 'morning' : 'evening';

      expect(service.currentSlot()).toBe(expected);
    });
  });

  describe('series', () => {
    it('always spans the charted window, oldest day first', () => {
      const series = service.morningSeries();

      expect(series).toHaveLength(CHART_DAYS);
      expect(series[0].dayStart).toBeLessThan(series.at(-1)!.dayStart);
      expect(series.at(-1)!.dayStart).toBe(startOfDay(new Date()));
    });

    it('leaves days without readings empty', () => {
      const series = service.morningSeries();

      expect(series.every((p) => p.systolic === null && p.count === 0)).toBe(true);
    });

    it('labels days as DD.MM', () => {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');

      expect(service.morningSeries().at(-1)!.label).toBe(`${dd}.${mm}`);
    });

    it('averages several readings from the same day and slot', () => {
      service.add(120, 80, 60, dayAt(0, 8));
      service.add(130, 90, 70, dayAt(0, 10));

      expect(service.morningSeries().at(-1)).toMatchObject({
        systolic: 125,
        diastolic: 85,
        pulse: 65,
        count: 2,
      });
    });

    it('places a reading on the day it was taken', () => {
      service.add(140, 95, 80, dayAt(-3, 9));

      const series = service.morningSeries();
      expect(series[CHART_DAYS - 4]).toMatchObject({ systolic: 140, count: 1 });
      expect(series[CHART_DAYS - 3].systolic).toBeNull();
    });

    it('keeps readings older than the window off the chart', () => {
      service.add(150, 100, 90, dayAt(-CHART_DAYS, 9));

      expect(service.morningSeries().every((p) => p.count === 0)).toBe(true);
      expect(service.entries()).toHaveLength(1);
    });

    it('keeps the oldest day of the window on the chart', () => {
      service.add(150, 100, 90, dayAt(-(CHART_DAYS - 1), 9));

      expect(service.morningSeries()[0]).toMatchObject({ systolic: 150, count: 1 });
    });
  });

  describe('averages', () => {
    it('averages both slots of the window together', () => {
      service.add(120, 80, 60, dayAt(-1, 9));
      service.add(140, 90, 80, dayAt(-1, 21));

      expect(service.windowAverage()).toMatchObject({
        systolic: 130,
        diastolic: 85,
        pulse: 70,
        count: 2,
      });
    });

    it('averages each slot on its own', () => {
      service.add(110, 70, 60, dayAt(-2, 9));
      service.add(120, 80, 64, dayAt(-1, 9));
      service.add(140, 90, 80, dayAt(-1, 21));

      expect(service.morningAverage()).toMatchObject({ systolic: 115, diastolic: 75, count: 2 });
      expect(service.eveningAverage()).toMatchObject({ systolic: 140, diastolic: 90, count: 1 });
    });

    it('ignores readings older than the window', () => {
      service.add(200, 120, 100, dayAt(-30, 9));
      service.add(120, 80, 60, dayAt(0, 9));

      expect(service.windowAverage()).toMatchObject({ systolic: 120, count: 1 });
    });

    it('classifies the windowed average', () => {
      service.add(150, 95, 80, dayAt(0, 9));

      expect(service.category()).toBe('high2');
    });

    it('follows the average, not the worst single reading', () => {
      service.add(150, 95, 80, dayAt(-1, 9));
      service.add(90, 61, 60, dayAt(-1, 21));

      expect(service.windowAverage()).toMatchObject({ systolic: 120, diastolic: 78 });
      expect(service.category()).toBe('elevated');
    });
  });

  describe('daysTracked', () => {
    it('counts a single day', () => {
      service.add(120, 80, 65, dayAt(0, 9));

      expect(service.daysTracked()).toBe(1);
    });

    it('counts from the first reading to today, gaps included', () => {
      service.add(120, 80, 65, dayAt(-6, 9));
      service.add(120, 80, 65, dayAt(0, 9));

      expect(service.daysTracked()).toBe(7);
    });

    it('keeps counting days beyond the charted window', () => {
      service.add(120, 80, 65, dayAt(-40, 9));

      expect(service.daysTracked()).toBe(41);
    });
  });

  describe('syncNow()', () => {
    it('rolls the window over once the date changes', () => {
      const today = startOfDay(new Date());
      service.add(120, 80, 65, dayAt(0, 9));

      vi.useFakeTimers();
      vi.setSystemTime(dayAt(1, 9));
      service.syncNow();

      const series = service.morningSeries();
      expect(series.at(-1)!.dayStart).toBeGreaterThan(today);
      expect(series.at(-2)).toMatchObject({ systolic: 120, count: 1 });
    });

    it('flips the current slot when noon passes', () => {
      vi.useFakeTimers();
      vi.setSystemTime(dayAt(0, 9));
      service.syncNow();
      expect(service.currentSlot()).toBe('morning');

      vi.setSystemTime(dayAt(0, 13));
      service.syncNow();
      expect(service.currentSlot()).toBe('evening');
    });
  });
});
