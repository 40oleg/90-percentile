/** One trip to the scales. `at` is an ISO timestamp of when it was recorded. */
export interface WeightEntry {
  id: string;
  kg: number;
  at: string;
}

/** How far back the weight chart looks. */
export type WeightRangeId = 'month' | 'quarter' | 'half';

export interface WeightRange {
  id: WeightRangeId;
  label: string;
  days: number;
}

export const WEIGHT_RANGES: readonly WeightRange[] = [
  { id: 'month', label: 'МЕСЯЦ', days: 30 },
  { id: 'quarter', label: '3 МЕС.', days: 90 },
  { id: 'half', label: 'ПОЛГОДА', days: 180 },
];

export function findRange(id: string): WeightRange | undefined {
  return WEIGHT_RANGES.find((range) => range.id === id);
}

/** One charted day: several weigh-ins on the same day are averaged into one. */
export interface WeightPoint {
  /** Local midnight of the day, as epoch ms. */
  dayStart: number;
  /** Short axis label, `DD.MM`. */
  label: string;
  kg: number;
  count: number;
}

/** `DD.MM` of the local day that `at` (epoch ms) falls in. */
export function dayLabel(at: number): string {
  const d = new Date(at);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

/**
 * Weight reads better with one decimal than with none: 74.4 and 74.6 are a real
 * difference, 74.44 is scale noise.
 */
export function roundKg(kg: number): number {
  return Math.round(kg * 10) / 10;
}

/** `74.5` → `74.5`, `74.0` → `74`; trailing zeroes only add noise. */
export function formatKg(kg: number): string {
  const rounded = roundKg(kg);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Same as {@link formatKg}, with an explicit sign for a change over time. */
export function formatDelta(kg: number): string {
  const rounded = roundKg(kg);
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${formatKg(Math.abs(rounded))}`;
}
