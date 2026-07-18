import { Injectable, computed, effect, signal } from '@angular/core';
import { CHALLENGES } from '../data/challenges.data';

const STORAGE_KEY = '90percentile.completed';

export type FilterMode = 'all' | 'completed' | 'incomplete';

@Injectable({ providedIn: 'root' })
export class ChallengeStateService {
  readonly challenges = CHALLENGES;

  private readonly completedIds = signal<Set<string>>(this.loadCompleted());
  readonly filter = signal<FilterMode>('all');

  readonly total = this.challenges.length;

  readonly completedCount = computed(() => this.completedIds().size);

  readonly percentile = computed(() =>
    Math.round((this.completedCount() / this.total) * 100),
  );

  readonly visibleChallenges = computed(() => {
    const mode = this.filter();
    const done = this.completedIds();
    return this.challenges.filter((c) => {
      if (mode === 'completed') return done.has(c.id);
      if (mode === 'incomplete') return !done.has(c.id);
      return true;
    });
  });

  constructor() {
    effect(() => {
      const ids = Array.from(this.completedIds());
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
      } catch {
        /* storage unavailable — progress just won't persist */
      }
    });
  }

  isCompleted(id: string): boolean {
    return this.completedIds().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.completedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.completedIds.set(next);
  }

  setFilter(mode: FilterMode): void {
    this.filter.set(mode);
  }

  private loadCompleted(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const ids: unknown = JSON.parse(raw);
      if (!Array.isArray(ids)) return new Set();
      return new Set(ids.filter((id): id is string => typeof id === 'string'));
    } catch {
      return new Set();
    }
  }
}
