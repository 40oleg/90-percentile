import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuizSessionService, shuffle } from './quiz-session.service';
import { QuizService } from './quiz.service';
import { ANGULAR_QUESTIONS } from '../data/quiz/angular.questions';
import { DEFAULT_QUESTIONS_PER_RUN } from '../data/quiz-topics.data';
import { SessionQuestion } from '../models/quiz.model';

const SESSION_KEY = '90percentile.quiz.session';

/** Deterministic pseudo-random source, so a drawn run is reproducible. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('QuizSessionService', () => {
  let session: QuizSessionService;
  let quiz: QuizService;

  function fresh(): QuizSessionService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    quiz = TestBed.inject(QuizService);
    return TestBed.inject(QuizSessionService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    quiz = TestBed.inject(QuizService);
    session = TestBed.inject(QuizSessionService);
  });

  /** Answers the current question right or wrong, then moves on. */
  function answerCurrent(correctly: boolean): void {
    const question = session.current()!;
    const pick = correctly
      ? question.correctIndex
      : (question.correctIndex + 1) % question.options.length;
    session.answer(pick);
    session.next();
  }

  /** Plays a whole run, getting exactly `correct` questions right. */
  function playRun(correct: number): void {
    const total = session.total();
    for (let i = 0; i < total; i++) answerCurrent(i < correct);
  }

  describe('start()', () => {
    it('draws a full run of questions', () => {
      expect(session.start('angular', seeded(1))).toBe(true);

      expect(session.status()).toBe('running');
      expect(session.total()).toBe(DEFAULT_QUESTIONS_PER_RUN);
      expect(session.index()).toBe(0);
    });

    it('never repeats a question inside one run', () => {
      session.start('angular', seeded(7));

      const ids = session.questions().map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('draws questions from the topic pack', () => {
      session.start('angular', seeded(3));

      const packIds = new Set(ANGULAR_QUESTIONS.map((q) => q.id));
      for (const question of session.questions()) {
        expect(packIds.has(question.id)).toBe(true);
      }
    });

    it('starts with every question unanswered', () => {
      session.start('angular', seeded(4));

      expect(session.questions().every((q) => q.answeredIndex === null)).toBe(true);
      expect(session.answeredCount()).toBe(0);
      expect(session.correctCount()).toBe(0);
    });

    it('keeps correctIndex pointing at the right option after shuffling', () => {
      session.start('angular', seeded(11));

      for (const drawn of session.questions()) {
        const source = ANGULAR_QUESTIONS.find((q) => q.id === drawn.id)!;
        expect(drawn.options[drawn.correctIndex]).toBe(source.options[source.correctIndex]);
        expect([...drawn.options].sort()).toEqual([...source.options].sort());
      }
    });

    it('shuffles the options rather than always keeping pack order', () => {
      session.start('angular', seeded(5));

      const moved = session.questions().filter((drawn) => {
        const source = ANGULAR_QUESTIONS.find((q) => q.id === drawn.id)!;
        return drawn.options.join('|') !== source.options.join('|');
      });
      expect(moved.length).toBeGreaterThan(0);
    });

    it('draws different runs for different random sources', () => {
      session.start('angular', seeded(1));
      const first = session.questions().map((q) => q.id);
      session.start('angular', seeded(999));
      const second = session.questions().map((q) => q.id);

      expect(first).not.toEqual(second);
    });

    it('refuses an unknown topic and changes nothing', () => {
      expect(session.start('nope')).toBe(false);

      expect(session.status()).toBe('idle');
      expect(session.questions()).toEqual([]);
    });
  });

  describe('answer()', () => {
    beforeEach(() => {
      session.start('angular', seeded(2));
    });

    it('reports a right answer and stores the pick', () => {
      const correct = session.current()!.correctIndex;

      expect(session.answer(correct)).toBe(true);
      expect(session.current()!.answeredIndex).toBe(correct);
      expect(session.correctCount()).toBe(1);
      expect(session.isAnswered()).toBe(true);
    });

    it('reports a wrong answer', () => {
      const wrong = (session.current()!.correctIndex + 1) % 4;

      expect(session.answer(wrong)).toBe(false);
      expect(session.correctCount()).toBe(0);
      expect(session.answeredCount()).toBe(1);
    });

    it('ignores a second answer to the same question', () => {
      const correct = session.current()!.correctIndex;
      session.answer(correct);

      expect(session.answer((correct + 1) % 4)).toBeNull();
      expect(session.current()!.answeredIndex).toBe(correct);
    });

    it.each([-1, 4, 99, 1.5, Number.NaN])('ignores the out-of-range pick %p', (pick) => {
      expect(session.answer(pick)).toBeNull();
      expect(session.answeredCount()).toBe(0);
    });

    it('does nothing when no run is going', () => {
      session.reset();

      expect(session.answer(0)).toBeNull();
    });

    it('leaves the other questions untouched', () => {
      session.answer(session.current()!.correctIndex);

      expect(session.questions().filter((q) => q.answeredIndex !== null)).toHaveLength(1);
    });
  });

  describe('next()', () => {
    beforeEach(() => {
      session.start('angular', seeded(6));
    });

    it('moves to the following question', () => {
      const first = session.current()!.id;
      session.answer(0);
      session.next();

      expect(session.index()).toBe(1);
      expect(session.current()!.id).not.toBe(first);
    });

    it('reports the last question', () => {
      expect(session.isLast()).toBe(false);

      for (let i = 0; i < DEFAULT_QUESTIONS_PER_RUN - 1; i++) {
        session.answer(0);
        session.next();
      }

      expect(session.isLast()).toBe(true);
    });

    it('finishes the run when moving past the last question', () => {
      playRun(0);

      expect(session.status()).toBe('finished');
      expect(session.index()).toBe(DEFAULT_QUESTIONS_PER_RUN - 1);
    });

    it('does nothing once the run is over', () => {
      playRun(0);
      session.next();

      expect(session.status()).toBe('finished');
    });
  });

  describe('finishing', () => {
    beforeEach(() => {
      session.start('angular', seeded(8));
    });

    it('scores the run', () => {
      playRun(12);

      expect(session.correctCount()).toBe(12);
      expect(session.total()).toBe(15);
      expect(session.percent()).toBe(80);
    });

    it('records exactly one attempt', () => {
      playRun(9);

      expect(quiz.attempts()).toHaveLength(1);
      expect(quiz.attempts()[0]).toMatchObject({ topicId: 'angular', correct: 9, total: 15 });
    });

    it('does not record twice if finish() is called again', () => {
      playRun(9);
      session.finish();

      expect(quiz.attempts()).toHaveLength(1);
    });

    it('collects the missed questions for the review', () => {
      playRun(13);

      expect(session.mistakes()).toHaveLength(2);
      for (const miss of session.mistakes()) {
        expect(miss.answeredIndex).not.toBe(miss.correctIndex);
      }
    });

    it('has no mistakes on a perfect run', () => {
      playRun(15);

      expect(session.percent()).toBe(100);
      expect(session.mistakes()).toEqual([]);
    });

    it('scores zero when everything is wrong', () => {
      playRun(0);

      expect(session.percent()).toBe(0);
      expect(session.mistakes()).toHaveLength(15);
    });
  });

  describe('leaving a run', () => {
    it('abandon() drops the run without recording anything', () => {
      session.start('angular', seeded(10));
      session.answer(session.current()!.correctIndex);
      session.abandon();

      expect(session.status()).toBe('idle');
      expect(session.questions()).toEqual([]);
      expect(quiz.attempts()).toEqual([]);
    });

    it('reset() returns to the topic list after a finished run', () => {
      session.start('angular', seeded(12));
      playRun(5);
      session.reset();

      expect(session.status()).toBe('idle');
      expect(quiz.attempts()).toHaveLength(1);
    });

    it('restart() draws a new run on the same topic', () => {
      session.start('angular', seeded(13));
      playRun(5);
      const first = session.questions().map((q) => q.id);

      expect(session.restart(seeded(77))).toBe(true);
      expect(session.status()).toBe('running');
      expect(session.answeredCount()).toBe(0);
      expect(session.questions().map((q) => q.id)).not.toEqual(first);
    });
  });

  describe('resuming an interrupted run', () => {
    it('stores a run in progress', () => {
      session.start('angular', seeded(14));
      session.answer(session.current()!.correctIndex);
      session.next();
      TestBed.tick();

      const stored = JSON.parse(localStorage.getItem(SESSION_KEY)!);
      expect(stored.topicId).toBe('angular');
      expect(stored.index).toBe(1);
      expect(stored.questions).toHaveLength(15);
    });

    it('restores the questions, the position and the answers', () => {
      session.start('angular', seeded(15));
      const ids = session.questions().map((q) => q.id);
      session.answer(session.current()!.correctIndex);
      session.next();
      session.answer((session.current()!.correctIndex + 1) % 4);
      TestBed.tick();

      const resumed = fresh();

      expect(resumed.status()).toBe('running');
      expect(resumed.questions().map((q: SessionQuestion) => q.id)).toEqual(ids);
      expect(resumed.index()).toBe(1);
      expect(resumed.correctCount()).toBe(1);
      expect(resumed.answeredCount()).toBe(2);
    });

    it('can be finished after being resumed', () => {
      session.start('angular', seeded(16));
      session.answer(session.current()!.correctIndex);
      session.next();
      TestBed.tick();

      session = fresh();
      playRun(0);

      expect(session.status()).toBe('finished');
      expect(quiz.attempts()).toHaveLength(1);
      expect(quiz.attempts()[0].correct).toBe(1);
    });

    it('clears the stored run once it is finished', () => {
      session.start('angular', seeded(17));
      playRun(3);
      TestBed.tick();

      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('clears the stored run when it is abandoned', () => {
      session.start('angular', seeded(18));
      TestBed.tick();
      session.abandon();
      TestBed.tick();

      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it('starts idle when there is nothing stored', () => {
      expect(fresh().status()).toBe('idle');
    });

    it.each([
      ['not JSON', 'oops'],
      ['an empty run', '{"topicId":"angular","index":0,"questions":[]}'],
      ['an unknown topic', '{"topicId":"gone","index":0,"questions":[{"id":"a"}]}'],
      ['a broken question', '{"topicId":"angular","index":0,"questions":[{"id":"a"}]}'],
      [
        'a negative index',
        '{"topicId":"angular","index":-1,"questions":[{"id":"a","prompt":"p","options":["a","b"],"correctIndex":0,"explanation":"e","answeredIndex":null}]}',
      ],
    ])('ignores a stored run that is %s', (_label, raw) => {
      localStorage.setItem(SESSION_KEY, raw);

      const restored = fresh();
      expect(restored.status()).toBe('idle');
      expect(restored.questions()).toEqual([]);
    });

    it('clamps an out-of-range stored index', () => {
      session.start('angular', seeded(19));
      TestBed.tick();
      const stored = JSON.parse(localStorage.getItem(SESSION_KEY)!);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...stored, index: 99 }));

      expect(fresh().index()).toBe(14);
    });
  });
});

describe('shuffle()', () => {
  it('keeps every item exactly once', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];

    expect([...shuffle(items, seeded(42))].sort((a, b) => a - b)).toEqual(items);
  });

  it('leaves the source array untouched', () => {
    const items = [1, 2, 3];
    shuffle(items, seeded(1));

    expect(items).toEqual([1, 2, 3]);
  });

  it('survives a random source that returns out-of-range values', () => {
    const items = [1, 2, 3, 4];

    expect([...shuffle(items, () => 1)].sort((a, b) => a - b)).toEqual(items);
    expect([...shuffle(items, () => -1)].sort((a, b) => a - b)).toEqual(items);
  });
});
