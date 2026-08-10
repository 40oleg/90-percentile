import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LABELS,
  MORNING_END_HOUR,
  SLOT_LABELS,
  classify,
  slotOf,
} from './pressure-entry.model';

/** Today at a given local hour and minute. */
function at(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('pressure model', () => {
  describe('slotOf()', () => {
    it('splits the day at noon', () => {
      expect(MORNING_END_HOUR).toBe(12);
    });

    it('counts a reading right after midnight as morning', () => {
      expect(slotOf(at(0, 1))).toBe('morning');
    });

    it('counts 11:59 as morning', () => {
      expect(slotOf(at(11, 59))).toBe('morning');
    });

    it('counts 12:00 sharp as evening', () => {
      expect(slotOf(at(12, 0))).toBe('evening');
    });

    it('counts a late-night reading as evening', () => {
      expect(slotOf(at(23, 59))).toBe('evening');
    });
  });

  describe('classify()', () => {
    it('calls a textbook reading normal', () => {
      expect(classify(115, 75)).toBe('normal');
    });

    it('calls a low systolic reading low', () => {
      expect(classify(85, 70)).toBe('low');
    });

    it('calls a low diastolic reading low', () => {
      expect(classify(110, 55)).toBe('low');
    });

    it('calls 120/75 elevated', () => {
      expect(classify(120, 75)).toBe('elevated');
    });

    it('calls 130/75 stage one', () => {
      expect(classify(130, 75)).toBe('high1');
    });

    it('calls a diastolic of 80 stage one', () => {
      expect(classify(118, 80)).toBe('high1');
    });

    it('calls 140/85 stage two', () => {
      expect(classify(140, 85)).toBe('high2');
    });

    it('calls a diastolic of 90 stage two', () => {
      expect(classify(125, 90)).toBe('high2');
    });

    it('lets the worse of the two values decide', () => {
      expect(classify(110, 95)).toBe('high2');
      expect(classify(160, 70)).toBe('high2');
    });
  });

  describe('labels', () => {
    it('labels every category', () => {
      expect(CATEGORY_LABELS.normal).toBe('НОРМА');
      expect(CATEGORY_LABELS.high2).toBe('ГИПЕРТОНИЯ 2');
      expect(Object.keys(CATEGORY_LABELS)).toHaveLength(5);
    });

    it('labels both slots', () => {
      expect(SLOT_LABELS.morning).toBe('УТРО');
      expect(SLOT_LABELS.evening).toBe('ВЕЧЕР');
    });
  });
});
