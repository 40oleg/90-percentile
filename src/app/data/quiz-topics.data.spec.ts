import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUESTIONS_PER_RUN,
  QUIZ_TOPICS,
  findTopic,
  questionsPerRun,
} from './quiz-topics.data';
import { AI_QUESTIONS } from './quiz/ai.questions';
import { ANGULAR_QUESTIONS } from './quiz/angular.questions';
import { MATH_QUESTIONS } from './quiz/math.questions';
import { QuizTopic } from '../models/quiz.model';

describe('quiz topics', () => {
  it('registers at least one topic', () => {
    expect(QUIZ_TOPICS.length).toBeGreaterThan(0);
  });

  it('asks 15 questions per run by default', () => {
    expect(DEFAULT_QUESTIONS_PER_RUN).toBe(15);
  });

  it('gives every topic a unique id', () => {
    const ids = QUIZ_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every topic a title, an icon and a description', () => {
    for (const topic of QUIZ_TOPICS) {
      expect(topic.title.trim()).not.toBe('');
      expect(topic.icon.trim()).not.toBe('');
      expect(topic.description.trim()).not.toBe('');
    }
  });

  it('finds a topic by id', () => {
    expect(findTopic('angular')?.id).toBe('angular');
  });

  it('returns undefined for an unknown topic', () => {
    expect(findTopic('nope')).toBeUndefined();
  });

  describe('questionsPerRun()', () => {
    it('uses the default when the topic does not override it', () => {
      expect(questionsPerRun(findTopic('angular')!)).toBe(DEFAULT_QUESTIONS_PER_RUN);
    });

    it('honours a topic-specific run length', () => {
      const topic = { ...findTopic('angular')!, questionsPerRun: 5 } as QuizTopic;
      expect(questionsPerRun(topic)).toBe(5);
    });

    it('never asks for more questions than the pack holds', () => {
      const topic: QuizTopic = {
        id: 'tiny',
        title: 'TINY',
        icon: '🧪',
        description: 'small pack',
        questions: ANGULAR_QUESTIONS.slice(0, 3),
      };
      expect(questionsPerRun(topic)).toBe(3);
    });
  });

  describe.each(QUIZ_TOPICS.map((topic) => [topic.id, topic] as const))(
    'topic %s',
    (_id, topic) => {
      it('holds enough questions for a full run', () => {
        expect(topic.questions.length).toBeGreaterThanOrEqual(DEFAULT_QUESTIONS_PER_RUN);
      });

      it('has unique question ids', () => {
        const ids = topic.questions.map((q) => q.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('has no duplicated prompts', () => {
        const prompts = topic.questions.map((q) => q.prompt.trim().toLowerCase());
        expect(new Set(prompts).size).toBe(prompts.length);
      });

      it('gives every question exactly four distinct options', () => {
        for (const question of topic.questions) {
          expect(question.options).toHaveLength(4);
          expect(new Set(question.options).size).toBe(4);
        }
      });

      it('points correctIndex at a real option', () => {
        for (const question of topic.questions) {
          expect(question.correctIndex).toBeGreaterThanOrEqual(0);
          expect(question.correctIndex).toBeLessThan(question.options.length);
          expect(Number.isInteger(question.correctIndex)).toBe(true);
        }
      });

      it('leaves no prompt, option or explanation empty', () => {
        for (const question of topic.questions) {
          expect(question.prompt.trim()).not.toBe('');
          expect(question.explanation.trim()).not.toBe('');
          for (const option of question.options) {
            expect(option.trim()).not.toBe('');
          }
        }
      });

      // A run shuffles the options anyway, so the stored position only has to be
      // varied enough to prove nothing was written with a copy-pasted index.
      it('does not park every correct answer on the same position', () => {
        const positions = new Set(topic.questions.map((q) => q.correctIndex));
        expect(positions.size).toBeGreaterThan(1);
      });
    },
  );
});

describe.each([
  ['angular', ANGULAR_QUESTIONS],
  ['ai', AI_QUESTIONS],
  ['math', MATH_QUESTIONS],
])('%s question pack', (topicId, pack) => {
  it('holds at least 100 questions', () => {
    expect(pack.length).toBeGreaterThanOrEqual(100);
  });

  it('is the pack wired into its topic', () => {
    expect(findTopic(topicId)!.questions).toBe(pack);
  });
});

describe('question ids across packs', () => {
  it('are globally unique', () => {
    const ids = QUIZ_TOPICS.flatMap((topic) => topic.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * A pack is worthless if the right answer can be picked without knowing the
 * subject, and the cheapest such tell is length: the elaborate option is the
 * correct one. These bounds lock that in for the Angular pack; the other packs
 * still have to be cleaned up the same way.
 */
describe('angular pack cannot be answered by option length', () => {
  const lengths = (q: (typeof ANGULAR_QUESTIONS)[number]) => q.options.map((o) => o.length);
  const margin = (q: (typeof ANGULAR_QUESTIONS)[number]) => {
    const lens = lengths(q);
    const others = lens.filter((_, i) => i !== q.correctIndex);
    return lens[q.correctIndex] - Math.max(...others);
  };

  it('never lets the correct option run away from the longest distractor', () => {
    const offenders = ANGULAR_QUESTIONS.filter((q) => margin(q) > 6).map((q) => q.id);
    expect(offenders).toEqual([]);
  });

  it('keeps all four options within one length band', () => {
    const offenders = ANGULAR_QUESTIONS.filter((q) => {
      const lens = lengths(q);
      return Math.max(...lens) - Math.min(...lens) > 24;
    }).map((q) => q.id);
    expect(offenders).toEqual([]);
  });

  it('leaves the longest option on a distractor most of the time', () => {
    const longest = ANGULAR_QUESTIONS.filter((q) => margin(q) > 0).length;
    expect(longest / ANGULAR_QUESTIONS.length).toBeLessThanOrEqual(0.45);
  });

  it('spreads the stored correct answer over all four positions', () => {
    const counts = [0, 0, 0, 0];
    for (const question of ANGULAR_QUESTIONS) counts[question.correctIndex]++;
    expect(Math.min(...counts)).toBeGreaterThan(ANGULAR_QUESTIONS.length / 8);
  });
});
