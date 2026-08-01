import { Injectable, computed, effect, signal } from '@angular/core';
import { QuizAttempt, scorePercent } from '../models/quiz.model';
import { QUIZ_TOPICS } from '../data/quiz-topics.data';

const ATTEMPTS_KEY = '90percentile.quiz.attempts';
const TOPIC_KEY = '90percentile.quiz.topic';

/** How many recent attempts the statistics chart draws. */
export const CHART_ATTEMPTS = 90;

/** Kept per topic — enough for the chart plus history, without growing forever. */
export const MAX_STORED_ATTEMPTS = 300;

/** Percentage a run has to reach to count as a good one. */
export const TARGET_PERCENT = 90;

export interface TopicStats {
  attempts: number;
  /** Percent of the most recent attempt, or null when there is none. */
  last: number | null;
  best: number;
  /** Mean percent across every stored attempt of the topic. */
  average: number;
  /** Runs that reached TARGET_PERCENT. */
  onTarget: number;
}

/** Attempt history for every topic, persisted in localStorage. */
@Injectable({ providedIn: 'root' })
export class QuizService {
  /** All attempts, newest first. */
  readonly attempts = signal<QuizAttempt[]>(this.loadAttempts());

  /** Topic the section opens on, remembered across launches. */
  readonly topicId = signal<string>(this.loadTopicId());

  readonly totalAttempts = computed(() => this.attempts().length);

  constructor() {
    effect(() => {
      const attempts = this.attempts();
      try {
        localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
      } catch {
        /* storage unavailable — history just won't survive a reload */
      }
    });

    effect(() => {
      const topic = this.topicId();
      try {
        localStorage.setItem(TOPIC_KEY, topic);
      } catch {
        /* storage unavailable — the section reopens on the first topic */
      }
    });
  }

  selectTopic(topicId: string): void {
    this.topicId.set(topicId);
  }

  /** Attempts of one topic, newest first. */
  attemptsFor(topicId: string): QuizAttempt[] {
    return this.attempts().filter((a) => a.topicId === topicId);
  }

  /** The last CHART_ATTEMPTS runs of a topic, oldest first — chart order. */
  recentFor(topicId: string, limit = CHART_ATTEMPTS): QuizAttempt[] {
    return this.attemptsFor(topicId).slice(0, limit).reverse();
  }

  statsFor(topicId: string): TopicStats {
    const attempts = this.attemptsFor(topicId);
    if (attempts.length === 0) {
      return { attempts: 0, last: null, best: 0, average: 0, onTarget: 0 };
    }

    const percents = attempts.map((a) => scorePercent(a.correct, a.total));
    const sum = percents.reduce((total, p) => total + p, 0);

    return {
      attempts: attempts.length,
      last: percents[0],
      best: Math.max(...percents),
      average: Math.round(sum / percents.length),
      onTarget: percents.filter((p) => p >= TARGET_PERCENT).length,
    };
  }

  /**
   * Stores a finished run. Anything that isn't a sane score is rejected so a
   * corrupt attempt can never poison the statistics.
   */
  record(
    topicId: string,
    correct: number,
    total: number,
    at: Date = new Date(),
  ): QuizAttempt | null {
    if (!Number.isInteger(correct) || !Number.isInteger(total)) return null;
    if (total <= 0 || correct < 0 || correct > total) return null;

    const attempt: QuizAttempt = {
      id: this.newId(),
      topicId,
      correct,
      total,
      at: at.toISOString(),
    };

    this.attempts.update((attempts) => trimPerTopic([attempt, ...attempts]));
    return attempt;
  }

  /** Drops the history of one topic, leaving the other topics untouched. */
  clearTopic(topicId: string): void {
    this.attempts.update((attempts) => attempts.filter((a) => a.topicId !== topicId));
  }

  clearAll(): void {
    this.attempts.set([]);
  }

  private newId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private loadAttempts(): QuizAttempt[] {
    try {
      const raw = localStorage.getItem(ATTEMPTS_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return trimPerTopic(
        parsed.filter(isQuizAttempt).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
      );
    } catch {
      return [];
    }
  }

  private loadTopicId(): string {
    const fallback = QUIZ_TOPICS[0]?.id ?? '';
    try {
      const raw = localStorage.getItem(TOPIC_KEY);
      return QUIZ_TOPICS.some((t) => t.id === raw) ? raw! : fallback;
    } catch {
      return fallback;
    }
  }
}

/** Keeps the newest MAX_STORED_ATTEMPTS of each topic, preserving order. */
function trimPerTopic(attempts: QuizAttempt[]): QuizAttempt[] {
  const seen = new Map<string, number>();
  return attempts.filter((attempt) => {
    const count = (seen.get(attempt.topicId) ?? 0) + 1;
    seen.set(attempt.topicId, count);
    return count <= MAX_STORED_ATTEMPTS;
  });
}

function isQuizAttempt(value: unknown): value is QuizAttempt {
  if (typeof value !== 'object' || value === null) return false;
  const attempt = value as Partial<QuizAttempt>;
  return (
    typeof attempt.id === 'string' &&
    typeof attempt.topicId === 'string' &&
    typeof attempt.correct === 'number' &&
    typeof attempt.total === 'number' &&
    Number.isInteger(attempt.correct) &&
    Number.isInteger(attempt.total) &&
    attempt.total > 0 &&
    attempt.correct >= 0 &&
    attempt.correct <= attempt.total &&
    typeof attempt.at === 'string' &&
    !Number.isNaN(Date.parse(attempt.at))
  );
}
