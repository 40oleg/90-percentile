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

/** One question inside a running test: options already shuffled for this run. */
export interface SessionQuestion {
  id: string;
  prompt: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
  /** Which option the user picked, or null while unanswered. */
  answeredIndex: number | null;
}

/** Whole-number percentage of correct answers, 0 when nothing was asked. */
export function scorePercent(correct: number, total: number): number {
  return total <= 0 ? 0 : Math.round((correct / total) * 100);
}
