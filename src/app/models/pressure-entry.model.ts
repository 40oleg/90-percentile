/** Which half of the day a reading belongs to. */
export type PressureSlot = 'morning' | 'evening';

/** The hour that splits the day: anything before it is a morning reading. */
export const MORNING_END_HOUR = 12;

/** One blood-pressure measurement. `at` is an ISO timestamp of when it was taken. */
export interface PressureEntry {
  id: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  at: string;
}

/**
 * The slot is never stored — it always follows the local clock time of the
 * reading, so a measurement logged at 11:59 is a morning one and 12:00 is not.
 */
export function slotOf(date: Date): PressureSlot {
  return date.getHours() < MORNING_END_HOUR ? 'morning' : 'evening';
}

/** One day of one slot on a chart. `null` values mean "nothing measured". */
export interface PressureDayPoint {
  /** Local midnight of the day, as epoch ms. */
  dayStart: number;
  /** Short axis label, `DD.MM`. */
  label: string;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  /** How many readings were averaged into this point. */
  count: number;
}

/** Averaged systolic/diastolic/pulse over some set of readings. */
export interface PressureAverage {
  systolic: number;
  diastolic: number;
  pulse: number;
  count: number;
}

/** Blood-pressure bands, roughly the AHA ones, worst match wins. */
export type PressureCategory = 'low' | 'normal' | 'elevated' | 'high1' | 'high2';

export function classify(systolic: number, diastolic: number): PressureCategory {
  if (systolic < 90 || diastolic < 60) return 'low';
  if (systolic >= 140 || diastolic >= 90) return 'high2';
  if (systolic >= 130 || diastolic >= 80) return 'high1';
  if (systolic >= 120) return 'elevated';
  return 'normal';
}

export const CATEGORY_LABELS: Record<PressureCategory, string> = {
  low: 'НИЗКОЕ',
  normal: 'НОРМА',
  elevated: 'ПОВЫШЕННОЕ',
  high1: 'ГИПЕРТОНИЯ 1',
  high2: 'ГИПЕРТОНИЯ 2',
};

export const SLOT_LABELS: Record<PressureSlot, string> = {
  morning: 'УТРО',
  evening: 'ВЕЧЕР',
};
