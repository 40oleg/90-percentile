import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { CalorieEntry } from '../models/calorie-entry.model';

const STORAGE_KEY = '90percentile.calories';

/** Daily target. Averages above it are shown in red, at or below it in green. */
export const CALORIE_NORM = 2200;

/** Highest single entry we accept — anything bigger is a typo, not a meal. */
export const MAX_ENTRY_KCAL = 100_000;

const DAY_MS = 86_400_000;
const DAY_TICK_MS = 60_000;

/** Local midnight of `date`, as epoch ms — the unit the day span is counted in. */
export function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Calorie log: every intake the user records is kept forever (never rotated),
 * so the daily average is measured over the whole tracked span — from the first
 * entry's day up to today, including days with nothing logged.
 */
@Injectable({ providedIn: 'root' })
export class CalorieService {
  readonly norm = CALORIE_NORM;

  /** Entries, newest first. */
  readonly entries = signal<CalorieEntry[]>(this.loadEntries());

  /** Local midnight of "today", refreshed so the average drops after midnight. */
  private readonly todayStart = signal(startOfDay(new Date()));

  readonly totalKcal = computed(() => this.entries().reduce((sum, e) => sum + e.kcal, 0));

  readonly entryCount = computed(() => this.entries().length);

  /** Days covered by the log: first logged day → today, inclusive. */
  readonly daysTracked = computed(() => {
    const entries = this.entries();
    if (entries.length === 0) return 0;

    const firstDay = entries.reduce(
      (min, e) => Math.min(min, startOfDay(new Date(e.at))),
      Number.POSITIVE_INFINITY,
    );
    const span = Math.round((this.todayStart() - firstDay) / DAY_MS) + 1;
    return Math.max(1, span);
  });

  readonly dailyAverage = computed(() => {
    const days = this.daysTracked();
    return days === 0 ? 0 : Math.round(this.totalKcal() / days);
  });

  readonly overNorm = computed(() => this.dailyAverage() > CALORIE_NORM);

  readonly todayKcal = computed(() => {
    const today = this.todayStart();
    return this.entries()
      .filter((e) => startOfDay(new Date(e.at)) === today)
      .reduce((sum, e) => sum + e.kcal, 0);
  });

  constructor() {
    effect(() => {
      const entries = this.entries();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      } catch {
        /* storage unavailable — the log just won't survive a reload */
      }
    });

    const timer = setInterval(() => this.syncToday(), DAY_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  /**
   * Records an intake. Returns false (and changes nothing) for anything that
   * isn't a positive, sane number of kcal.
   */
  add(kcal: number, at: Date = new Date()): boolean {
    if (!Number.isFinite(kcal)) return false;
    const rounded = Math.round(kcal);
    if (rounded <= 0 || rounded > MAX_ENTRY_KCAL) return false;

    this.syncToday();
    const entry: CalorieEntry = { id: this.newId(), kcal: rounded, at: at.toISOString() };
    this.entries.update((entries) => [entry, ...entries]);
    return true;
  }

  remove(id: string): void {
    this.entries.update((entries) => entries.filter((e) => e.id !== id));
  }

  clear(): void {
    this.entries.set([]);
  }

  /** Re-reads the wall clock; the average shifts once the date rolls over. */
  syncToday(): void {
    const today = startOfDay(new Date());
    if (today !== this.todayStart()) this.todayStart.set(today);
  }

  private newId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private loadEntries(): CalorieEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isCalorieEntry).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    } catch {
      return [];
    }
  }
}

function isCalorieEntry(value: unknown): value is CalorieEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<CalorieEntry>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.kcal === 'number' &&
    Number.isFinite(entry.kcal) &&
    entry.kcal > 0 &&
    typeof entry.at === 'string' &&
    !Number.isNaN(Date.parse(entry.at))
  );
}
