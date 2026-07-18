import { describe, expect, it } from 'vitest';
import { PIXEL_ICONS } from './pixel-icons.data';

describe('PIXEL_ICONS', () => {
  for (const [key, pattern] of Object.entries(PIXEL_ICONS)) {
    describe(key, () => {
      it('has exactly 8 rows', () => {
        expect(pattern.length).toBe(8);
      });

      it('has exactly 8 columns per row', () => {
        for (const row of pattern) {
          expect(row.length).toBe(8);
        }
      });

      it('only contains "." and "1"', () => {
        for (const row of pattern) {
          expect(row).toMatch(/^[.1]{8}$/);
        }
      });

      it('has at least one filled pixel', () => {
        const filled = pattern.join('').split('').filter((c) => c === '1').length;
        expect(filled).toBeGreaterThan(0);
      });
    });
  }
});
