/**
 * The escape hatch offered on every question. It is appended to a run rather
 * than stored in a pack, always sits last, and never counts as correct — the
 * point is an honest "I don't know" instead of a guess that pollutes the stats.
 */
export const DONT_KNOW_OPTION = 'НЕ ЗНАЮ';

/** A single multiple-choice question. Exactly four options, one of them right. */
export interface QuizQuestion {
  id: string;
  prompt: string;
  options: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** Shown after answering — the section doubles as a study tool. */
  explanation: string;
}

/**
 * A pack of questions the user can be tested on. Adding a topic is one data
 * file plus one entry in `QUIZ_TOPICS` — nothing in the UI or services changes.
 */
export interface QuizTopic {
  id: string;
  title: string;
  icon: string;
  description: string;
  /** Questions drawn per run; falls back to `DEFAULT_QUESTIONS_PER_RUN`. */
  questionsPerRun?: number;
  questions: readonly QuizQuestion[];
}

/** A finished run, kept forever so the stats chart has history to draw. */
export interface QuizAttempt {
  id: string;
  topicId: string;
  correct: number;
  total: number;
  /** ISO timestamp of when the run finished. */
  at: string;
}

/**
 * One question inside a running test: the four options already shuffled for
 * this run, with {@link DONT_KNOW_OPTION} appended as the last one.
 */
export interface SessionQuestion {
  id: string;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  /** Which option the user picked, or null while unanswered. */
  answeredIndex: number | null;
}

/** Whether the pick on this question was the "I don't know" one. */
export function isDontKnow(question: SessionQuestion): boolean {
  const picked = question.answeredIndex;
  return picked !== null && question.options[picked] === DONT_KNOW_OPTION;
}

/** Whole-number percentage of correct answers, 0 when nothing was asked. */
export function scorePercent(correct: number, total: number): number {
  return total <= 0 ? 0 : Math.round((correct / total) * 100);
}
