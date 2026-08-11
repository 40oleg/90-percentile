import { describe, expect, it } from 'vitest';
import {
  WEIGHT_RANGES,
  dayLabel,
  findRange,
  formatDelta,
  formatKg,
  roundKg,
} from './weight-entry.model';

describe('weight model', () => {
  describe('ranges', () => {
    it('offers a month, a quarter and half a year', () => {
      expect(WEIGHT_RANGES.map((r) => r.id)).toEqual(['month', 'quarter', 'half']);
      expect(WEIGHT_RANGES.map((r) => r.days)).toEqual([30, 90, 180]);
    });

    it('labels every range', () => {
      expect(WEIGHT_RANGES.map((r) => r.label)).toEqual(['МЕСЯЦ', '3 МЕС.', 'ПОЛГОДА']);
    });

    it('finds a range by id', () => {
      expect(findRange('quarter')?.days).toBe(90);
    });

    it('finds nothing for an unknown id', () => {
      expect(findRange('decade')).toBeUndefined();
    });
  });

  describe('roundKg()', () => {
    it('keeps one decimal', () => {
      expect(roundKg(74.44)).toBe(74.4);
      expect(roundKg(74.46)).toBe(74.5);
    });

    it('leaves a whole number alone', () => {
      expect(roundKg(74)).toBe(74);
    });
  });

  describe('formatKg()', () => {
    it('drops a trailing zero', () => {
      expect(formatKg(74.0)).toBe('74');
    });

    it('keeps a real decimal', () => {
      expect(formatKg(74.5)).toBe('74.5');
    });

    it('rounds before formatting', () => {
      expect(formatKg(74.449)).toBe('74.4');
    });
  });

  describe('formatDelta()', () => {
    it('marks a gain with a plus', () => {
      expect(formatDelta(1.5)).toBe('+1.5');
    });

    it('marks a loss with a minus', () => {
      expect(formatDelta(-1.5)).toBe('−1.5');
    });

    it('shows no sign for no change', () => {
      expect(formatDelta(0)).toBe('0');
      expect(formatDelta(0.04)).toBe('0');
    });
  });

  describe('dayLabel()', () => {
    it('pads the day and the month', () => {
      expect(dayLabel(new Date(2026, 0, 5).getTime())).toBe('05.01');
    });

    it('formats a two-digit date', () => {
      expect(dayLabel(new Date(2026, 10, 23).getTime())).toBe('23.11');
    });
  });
});
