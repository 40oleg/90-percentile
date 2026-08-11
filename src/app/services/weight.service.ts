import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  WEIGHT_RANGES,
  WeightEntry,
  WeightPoint,
  WeightRangeId,
  dayLabel,
  findRange,
  roundKg,
} from '../models/weight-entry.model';

const STORAGE_KEY = '90percentile.weight';
const RANGE_KEY = '90percentile.weight.range';

/** Accepted range — outside it it is a typo, not a person. */
export const WEIGHT_LIMITS = { min: 20, max: 500 } as const;

const DAY_TICK_MS = 60_000;

/** Local midnight of `date`, as epoch ms — the unit days are counted in. */
export function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Calendar-day arithmetic, so a DST switch never shifts a day boundary. */
function shiftDay(dayStart: number, days: number): number {
  const d = new Date(dayStart);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/**
 * Weight diary: every weigh-in is kept forever (never rotated), while the chart
 * shows the stretch the user picked — a month, three months or half a year.
 */
@Injectable({ providedIn: 'root' })
export class WeightService {
  readonly ranges = WEIGHT_RANGES;
  readonly limits = WEIGHT_LIMITS;

  /** Weigh-ins, newest first. */
  readonly entries = signal<WeightEntry[]>(this.loadEntries());

  /** The stretch the chart covers, remembered across launches. */
  readonly rangeId = signal<WeightRangeId>(this.loadRange());

  /** Local midnight of "today", refreshed so the window rolls over at midnight. */
  private readonly todayStart = signal(startOfDay(new Date()));

  readonly count = computed(() => this.entries().length);

  readonly range = computed(() => findRange(this.rangeId()) ?? WEIGHT_RANGES[0]);

  /** The most recent weigh-in, whenever it happened. */
  readonly latest = computed<WeightEntry | null>(() => this.entries()[0] ?? null);

  readonly currentKg = computed(() => this.latest()?.kg ?? null);

  /** Oldest day the chart shows, local midnight. */
  readonly windowFrom = computed(() => shiftDay(this.todayStart(), -(this.range().days - 1)));

  readonly windowTo = this.todayStart.asReadonly();

  /** One point per measured day of the window, oldest first. */
  readonly series = computed<WeightPoint[]>(() => {
    const from = this.windowFrom();
    const sums = new Map<number, { kg: number; count: number }>();

    for (const entry of this.entries()) {
      const day = startOfDay(new Date(entry.at));
      if (day < from) continue;

      const bucket = sums.get(day) ?? { kg: 0, count: 0 };
      bucket.kg += entry.kg;
      bucket.count += 1;
      sums.set(day, bucket);
    }

    return [...sums.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dayStart, bucket]) => ({
        dayStart,
        label: dayLabel(dayStart),
        kg: roundKg(bucket.kg / bucket.count),
        count: bucket.count,
      }));
  });

  /** Weight at the start of the window, as measured on its first tracked day. */
  readonly firstKg = computed(() => this.series()[0]?.kg ?? null);

  /** Change across the window: negative means the number went down. */
  readonly change = computed(() => {
    const points = this.series();
    if (points.length < 2) return null;
    return roundKg(points[points.length - 1].kg - points[0].kg);
  });

  readonly minKg = computed(() => {
    const points = this.series();
    return points.length === 0 ? null : Math.min(...points.map((p) => p.kg));
  });

  readonly maxKg = computed(() => {
    const points = this.series();
    return points.length === 0 ? null : Math.max(...points.map((p) => p.kg));
  });

  constructor() {
    effect(() => {
      const entries = this.entries();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      } catch {
        /* storage unavailable — the diary just won't survive a reload */
      }
    });

    effect(() => {
      const range = this.rangeId();
      try {
        localStorage.setItem(RANGE_KEY, range);
      } catch {
        /* storage unavailable — the chart just always opens on the default range */
      }
    });

    const timer = setInterval(() => this.syncToday(), DAY_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /**
   * Records a weigh-in. Returns false (and changes nothing) for anything that
   * isn't a sane number of kilograms.
   */
  add(kg: number, at: Date = new Date()): boolean {
    if (!Number.isFinite(kg)) return false;
    const rounded = roundKg(kg);
    if (rounded < WEIGHT_LIMITS.min || rounded > WEIGHT_LIMITS.max) return false;
    if (Number.isNaN(at.getTime())) return false;

    this.syncToday();
    const entry: WeightEntry = { id: this.newId(), kg: rounded, at: at.toISOString() };
    this.entries.update((entries) => [entry, ...entries].sort(byNewest));
    return true;
  }

  remove(id: string): void {
    this.entries.update((entries) => entries.filter((e) => e.id !== id));
  }

  clear(): void {
    this.entries.set([]);
  }

  selectRange(id: WeightRangeId): void {
    if (findRange(id)) this.rangeId.set(id);
  }

  /** Re-reads the wall clock; the window shifts once the date rolls over. */
  syncToday(): void {
    const today = startOfDay(new Date());
    if (today !== this.todayStart()) this.todayStart.set(today);
  }

  private newId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private loadEntries(): WeightEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isWeightEntry).sort(byNewest);
    } catch {
      return [];
    }
  }

  private loadRange(): WeightRangeId {
    try {
      return findRange(localStorage.getItem(RANGE_KEY) ?? '')?.id ?? WEIGHT_RANGES[0].id;
    } catch {
      return WEIGHT_RANGES[0].id;
    }
  }
}

function byNewest(a: WeightEntry, b: WeightEntry): number {
  return Date.parse(b.at) - Date.parse(a.at);
}

function isWeightEntry(value: unknown): value is WeightEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<WeightEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.kg === 'number' &&
    Number.isFinite(entry.kg) &&
    entry.kg > 0 &&
    typeof entry.at === 'string' &&
    !Number.isNaN(Date.parse(entry.at))
  );
}
