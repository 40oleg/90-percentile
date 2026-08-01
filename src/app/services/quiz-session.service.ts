import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { QuizQuestion, QuizTopic, SessionQuestion, scorePercent } from '../models/quiz.model';
import { findTopic, questionsPerRun } from '../data/quiz-topics.data';
import { QuizService } from './quiz.service';

const SESSION_KEY = '90percentile.quiz.session';

export type QuizStatus = 'idle' | 'running' | 'finished';

/** Injectable randomness so tests can run a deterministic draw. */
export type Rng = () => number;

interface StoredSession {
  topicId: string;
  index: number;
  questions: SessionQuestion[];
}

/**
 * One test run: draws a random subset of a topic's questions, tracks answers
 * and hands the finished score to `QuizService`.
 *
 * A run in progress is written to localStorage, so closing the PWA mid-test
 * (or a phone killing the tab) doesn't lose the answers already given.
 */
@Injectable({ providedIn: 'root' })
export class QuizSessionService {
  private readonly quiz = inject(QuizService);

  readonly status = signal<QuizStatus>('idle');
  readonly topicId = signal<string>('');
  readonly questions = signal<SessionQuestion[]>([]);
  /** Index of the question on screen. */
  readonly index = signal(0);

  readonly total = computed(() => this.questions().length);
  readonly current = computed<SessionQuestion | null>(() => this.questions()[this.index()] ?? null);
  readonly isAnswered = computed(() => this.current()?.answeredIndex != null);
  readonly isLast = computed(() => this.index() >= this.total() - 1);

  readonly correctCount = computed(
    () => this.questions().filter((q) => q.answeredIndex === q.correctIndex).length,
  );
  readonly answeredCount = computed(
    () => this.questions().filter((q) => q.answeredIndex !== null).length,
  );
  readonly percent = computed(() => scorePercent(this.correctCount(), this.total()));

  /** Questions the user got wrong — the result screen reviews them. */
  readonly mistakes = computed(() =>
    this.questions().filter((q) => q.answeredIndex !== null && q.answeredIndex !== q.correctIndex),
  );

  constructor() {
    this.restore();

    effect(() => {
      const running = this.status() === 'running';
      const payload: StoredSession = {
        topicId: this.topicId(),
        index: this.index(),
        questions: this.questions(),
      };
      try {
        if (running) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        /* storage unavailable — an interrupted run just can't be resumed */
      }
    });
  }

  /**
   * Draws a fresh run for a topic. Returns false (changing nothing) for an
   * unknown or empty topic.
   */
  start(topicId: string, rng: Rng = Math.random): boolean {
    const topic = findTopic(topicId);
    if (!topic || topic.questions.length === 0) return false;

    this.topicId.set(topicId);
    this.questions.set(drawQuestions(topic, rng));
    this.index.set(0);
    this.status.set('running');
    return true;
  }

  /**
   * Records the pick for the current question. Returns whether it was right,
   * or null if there was nothing to answer (already answered, or not running).
   */
  answer(optionIndex: number): boolean | null {
    if (this.status() !== 'running') return null;
    const current = this.current();
    if (!current || current.answeredIndex !== null) return null;
    if (!Number.isInteger(optionIndex)) return null;
    if (optionIndex < 0 || optionIndex >= current.options.length) return null;

    const at = this.index();
    this.questions.update((questions) =>
      questions.map((q, i) => (i === at ? { ...q, answeredIndex: optionIndex } : q)),
    );
    return optionIndex === current.correctIndex;
  }

  /** Moves to the next question, or finishes the run on the last one. */
  next(): void {
    if (this.status() !== 'running') return;
    if (this.isLast()) {
      this.finish();
      return;
    }
    this.index.update((i) => i + 1);
  }

  /** Ends the run and stores the score. */
  finish(): void {
    if (this.status() !== 'running') return;
    this.status.set('finished');
    this.quiz.record(this.topicId(), this.correctCount(), this.total());
  }

  /** Abandons a run without recording anything. */
  abandon(): void {
    this.reset();
  }

  /** Leaves the result screen and goes back to the topic list. */
  reset(): void {
    this.status.set('idle');
    this.questions.set([]);
    this.index.set(0);
  }

  /** Starts a new run on the same topic. */
  restart(rng: Rng = Math.random): boolean {
    return this.start(this.topicId(), rng);
  }

  private restore(): void {
    const stored = this.loadSession();
    if (!stored) return;

    this.topicId.set(stored.topicId);
    this.questions.set(stored.questions);
    this.index.set(Math.min(stored.index, stored.questions.length - 1));
    this.status.set('running');
  }

  private loadSession(): StoredSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredSession(parsed)) return null;
      if (!findTopic(parsed.topicId)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

/** Fisher–Yates on a copy — the caller's array is left alone. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const clamped = Math.min(Math.max(j, 0), i);
    [out[i], out[clamped]] = [out[clamped], out[i]];
  }
  return out;
}

/** A random subset of the topic's pack, each question's options shuffled too. */
function drawQuestions(topic: QuizTopic, rng: Rng): SessionQuestion[] {
  return shuffle(topic.questions, rng)
    .slice(0, questionsPerRun(topic))
    .map((question) => toSessionQuestion(question, rng));
}

function toSessionQuestion(question: QuizQuestion, rng: Rng): SessionQuestion {
  const correct = question.options[question.correctIndex];
  const options = shuffle(question.options, rng);
  return {
    id: question.id,
    prompt: question.prompt,
    options,
    correctIndex: options.indexOf(correct),
    explanation: question.explanation,
    answeredIndex: null,
  };
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Partial<StoredSession>;
  if (typeof session.topicId !== 'string' || typeof session.index !== 'number') return false;
  if (!Array.isArray(session.questions) || session.questions.length === 0) return false;
  if (session.index < 0 || !Number.isInteger(session.index)) return false;
  return session.questions.every(isSessionQuestion);
}

function isSessionQuestion(value: unknown): value is SessionQuestion {
  if (typeof value !== 'object' || value === null) return false;
  const question = value as Partial<SessionQuestion>;
  return (
    typeof question.id === 'string' &&
    typeof question.prompt === 'string' &&
    Array.isArray(question.options) &&
    question.options.length > 0 &&
    question.options.every((option) => typeof option === 'string') &&
    typeof question.correctIndex === 'number' &&
    question.correctIndex >= 0 &&
    question.correctIndex < question.options.length &&
    typeof question.explanation === 'string' &&
    (question.answeredIndex === null ||
      (typeof question.answeredIndex === 'number' &&
        question.answeredIndex >= 0 &&
        question.answeredIndex < question.options.length))
  );
}
