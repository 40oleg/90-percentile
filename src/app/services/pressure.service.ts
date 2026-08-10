import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  PressureAverage,
  PressureCategory,
  PressureDayPoint,
  PressureEntry,
  PressureSlot,
  classify,
  slotOf,
} from '../models/pressure-entry.model';

const STORAGE_KEY = '90percentile.pressure';

/** How many days the charts and the averages cover. */
export const CHART_DAYS = 14;

/** Accepted ranges — outside them it is a typo, not a measurement. */
export const PRESSURE_LIMITS = {
  systolic: { min: 50, max: 300 },
  diastolic: { min: 30, max: 250 },
  pulse: { min: 20, max: 300 },
} as const;

const DAY_MS = 86_400_000;
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

function dayLabel(dayStart: number): string {
  const d = new Date(dayStart);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

interface Bucket {
  systolic: number;
  diastolic: number;
  pulse: number;
  count: number;
}

function emptyBucket(): Bucket {
  return { systolic: 0, diastolic: 0, pulse: 0, count: 0 };
}

function collect(bucket: Bucket, entry: PressureEntry): void {
  bucket.systolic += entry.systolic;
  bucket.diastolic += entry.diastolic;
  bucket.pulse += entry.pulse;
  bucket.count += 1;
}

function averageOf(bucket: Bucket): PressureAverage | null {
  if (bucket.count === 0) return null;
  return {
    systolic: Math.round(bucket.systolic / bucket.count),
    diastolic: Math.round(bucket.diastolic / bucket.count),
    pulse: Math.round(bucket.pulse / bucket.count),
    count: bucket.count,
  };
}

function inRange(value: number, limits: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= limits.min && value <= limits.max;
}

/**
 * Blood-pressure diary: every reading is kept forever (never rotated), while
 * the charts and the averages look at the last {@link CHART_DAYS} days. Readings
 * taken before noon count as morning ones, the rest as evening ones.
 */
@Injectable({ providedIn: 'root' })
export class PressureService {
  readonly chartDays = CHART_DAYS;
  readonly limits = PRESSURE_LIMITS;

  /** Readings, newest first. */
  readonly entries = signal<PressureEntry[]>(this.loadEntries());

  /** Local midnight of "today", refreshed so the window rolls over at midnight. */
  private readonly todayStart = signal(startOfDay(new Date()));

  /** Which slot a reading taken right now would land in. */
  private readonly nowSlot = signal<PressureSlot>(slotOf(new Date()));
  readonly currentSlot = this.nowSlot.asReadonly();

  readonly count = computed(() => this.entries().length);

  readonly latest = computed<PressureEntry | null>(() => this.entries()[0] ?? null);

  /** Days covered by the diary: first logged day → today, inclusive. */
  readonly daysTracked = computed(() => {
    const entries = this.entries();
    if (entries.length === 0) return 0;

    const first = entries.reduce(
      (min, e) => Math.min(min, startOfDay(new Date(e.at))),
      Number.POSITIVE_INFINITY,
    );
    const span = Math.round((this.todayStart() - first) / DAY_MS) + 1;
    return Math.max(1, span);
  });

  /** The days the charts span: oldest first, today last. */
  private readonly windowDays = computed(() => {
    const today = this.todayStart();
    const days: number[] = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) days.push(shiftDay(today, -i));
    return days;
  });

  readonly morningSeries = computed(() => this.seriesFor('morning'));
  readonly eveningSeries = computed(() => this.seriesFor('evening'));

  readonly morningAverage = computed(() => this.averageFor('morning'));
  readonly eveningAverage = computed(() => this.averageFor('evening'));

  /** Average over both slots of the charted window, or null when it is empty. */
  readonly windowAverage = computed(() => this.averageFor(null));

  readonly category = computed<PressureCategory | null>(() => {
    const avg = this.windowAverage();
    return avg === null ? null : classify(avg.systolic, avg.diastolic);
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

    const timer = setInterval(() => this.syncNow(), DAY_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /**
   * Records a reading. Returns false (and changes nothing) unless all three
   * values are sane whole numbers and the upper value beats the lower one.
   */
  add(systolic: number, diastolic: number, pulse: number, at: Date = new Date()): boolean {
    const sys = Math.round(systolic);
    const dia = Math.round(diastolic);
    const bpm = Math.round(pulse);

    if (!inRange(sys, PRESSURE_LIMITS.systolic)) return false;
    if (!inRange(dia, PRESSURE_LIMITS.diastolic)) return false;
    if (!inRange(bpm, PRESSURE_LIMITS.pulse)) return false;
    if (sys <= dia) return false;
    if (Number.isNaN(at.getTime())) return false;

    this.syncNow();
    const entry: PressureEntry = {
      id: this.newId(),
      systolic: sys,
      diastolic: dia,
      pulse: bpm,
      at: at.toISOString(),
    };
    this.entries.update((entries) => [entry, ...entries].sort(byNewest));
    return true;
  }

  remove(id: string): void {
    this.entries.update((entries) => entries.filter((e) => e.id !== id));
  }

  clear(): void {
    this.entries.set([]);
  }

  /** Re-reads the wall clock; the window and the slot hint follow it. */
  syncNow(): void {
    const now = new Date();
    const today = startOfDay(now);
    if (today !== this.todayStart()) this.todayStart.set(today);

    const slot = slotOf(now);
    if (slot !== this.nowSlot()) this.nowSlot.set(slot);
  }

  /** One point per day of the window, with same-day readings averaged together. */
  private seriesFor(slot: PressureSlot): PressureDayPoint[] {
    const buckets = new Map<number, Bucket>();
    const days = this.windowDays();
    const from = days[0];

    for (const entry of this.entries()) {
      const at = new Date(entry.at);
      if (slotOf(at) !== slot) continue;
      const day = startOfDay(at);
      if (day < from) continue;

      const bucket = buckets.get(day) ?? emptyBucket();
      collect(bucket, entry);
      buckets.set(day, bucket);
    }

    return days.map((dayStart) => {
      const average = averageOf(buckets.get(dayStart) ?? emptyBucket());
      return {
        dayStart,
        label: dayLabel(dayStart),
        systolic: average?.systolic ?? null,
        diastolic: average?.diastolic ?? null,
        pulse: average?.pulse ?? null,
        count: average?.count ?? 0,
      };
    });
  }

  /** Flat average over the window; `slot` of null takes both halves of the day. */
  private averageFor(slot: PressureSlot | null): PressureAverage | null {
    const from = this.windowDays()[0];
    const bucket = emptyBucket();

    for (const entry of this.entries()) {
      const at = new Date(entry.at);
      if (startOfDay(at) < from) continue;
      if (slot !== null && slotOf(at) !== slot) continue;
      collect(bucket, entry);
    }

    return averageOf(bucket);
  }

  private newId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private loadEntries(): PressureEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isPressureEntry).sort(byNewest);
    } catch {
      return [];
    }
  }
}

function byNewest(a: PressureEntry, b: PressureEntry): number {
  return Date.parse(b.at) - Date.parse(a.at);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPressureEntry(value: unknown): value is PressureEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<PressureEntry>;
  return (
    typeof entry.id === 'string' &&
    isPositiveNumber(entry.systolic) &&
    isPositiveNumber(entry.diastolic) &&
    isPositiveNumber(entry.pulse) &&
    typeof entry.at === 'string' &&
    !Number.isNaN(Date.parse(entry.at))
  );
}
