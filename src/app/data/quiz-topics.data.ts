import { QuizTopic } from '../models/quiz.model';
import { AI_QUESTIONS } from './quiz/ai.questions';
import { ANGULAR_QUESTIONS } from './quiz/angular.questions';
import { MATH_QUESTIONS } from './quiz/math.questions';

/** How many questions one run asks, unless a topic overrides it. */
export const DEFAULT_QUESTIONS_PER_RUN = 15;

/**
 * Every topic the section can test on.
 *
 * To add one: drop a `data/quiz/<name>.questions.ts` exporting a
 * `QuizQuestion[]` and append an entry here. The UI, the storage and the
 * statistics pick it up on their own — attempts are kept per topic id, so an
 * existing topic's history survives as long as its id doesn't change.
 */
export const QUIZ_TOPICS: readonly QuizTopic[] = [
  {
    id: 'angular',
    title: 'ANGULAR',
    icon: '🅰️',
    description: 'Сигналы, DI, RxJS, роутер, формы',
    questions: ANGULAR_QUESTIONS,
  },
  {
    id: 'ai',
    title: 'ИИ',
    icon: '🤖',
    description: 'Агенты, харнес, MCP, контекст, кэш',
    questions: AI_QUESTIONS,
  },
  {
    id: 'math',
    title: 'ВЫШМАТ',
    icon: '📐',
    description: 'Матан, линал, ряды, ДУ, теорвер',
    questions: MATH_QUESTIONS,
  },
];

export function findTopic(id: string): QuizTopic | undefined {
  return QUIZ_TOPICS.find((topic) => topic.id === id);
}

/** Questions drawn per run for a topic, never more than the pack holds. */
export function questionsPerRun(topic: QuizTopic): number {
  return Math.min(topic.questionsPerRun ?? DEFAULT_QUESTIONS_PER_RUN, topic.questions.length);
}
