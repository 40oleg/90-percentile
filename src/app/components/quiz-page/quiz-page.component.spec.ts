import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuizPageComponent } from './quiz-page.component';
import { QuizService } from '../../services/quiz.service';
import { QuizSessionService } from '../../services/quiz-session.service';
import { DEFAULT_QUESTIONS_PER_RUN, QUIZ_TOPICS } from '../../data/quiz-topics.data';

describe('QuizPageComponent', () => {
  let fixture: ComponentFixture<QuizPageComponent>;
  let quiz: QuizService;
  let session: QuizSessionService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [QuizPageComponent] }).compileComponents();
    quiz = TestBed.inject(QuizService);
    session = TestBed.inject(QuizSessionService);
    fixture = TestBed.createComponent(QuizPageComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function el<T extends HTMLElement>(selector: string): T {
    return root().querySelector(selector) as T;
  }

  function all(selector: string): HTMLElement[] {
    return Array.from(root().querySelectorAll(selector));
  }

  function text(selector: string): string {
    return el(selector)?.textContent?.trim() ?? '';
  }

  async function click(selector: string): Promise<void> {
    el<HTMLButtonElement>(selector).click();
    await fixture.whenStable();
  }

  async function start(): Promise<void> {
    await click('.start-btn');
  }

  /** Answers the question on screen and moves on. */
  async function answer(correctly: boolean): Promise<void> {
    const question = session.current()!;
    const pick = correctly
      ? question.correctIndex
      : (question.correctIndex + 1) % question.options.length;
    all('.option')[pick].click();
    await fixture.whenStable();
    await click('.next-btn');
  }

  /** Plays a whole run with `correct` right answers. */
  async function playRun(correct: number): Promise<void> {
    for (let i = 0; i < DEFAULT_QUESTIONS_PER_RUN; i++) await answer(i < correct);
  }

  function statValue(label: string): string {
    const stat = all('.qstat').find((s) =>
      s.querySelector('.qstat-label')!.textContent!.includes(label),
    );
    return stat!.querySelector('.qstat-value')!.textContent!.trim();
  }

  describe('topic screen', () => {
    it('lists every registered topic', () => {
      expect(all('.topic')).toHaveLength(QUIZ_TOPICS.length);
      expect(text('.topic-title')).toBe('ANGULAR');
    });

    it('marks the selected topic', () => {
      expect(el('.topic').className).toContain('active');
      expect(el('.topic').getAttribute('aria-pressed')).toBe('true');
    });

    it('shows how big the question pack is', () => {
      expect(text('.topic-pool')).toContain(String(QUIZ_TOPICS[0].questions.length));
    });

    it('says the topic has never been taken', () => {
      expect(text('.topic-best')).toBe('НЕ СДАВАЛСЯ');
    });

    it('announces the run length on the start button', () => {
      expect(text('.start-btn')).toContain(`${DEFAULT_QUESTIONS_PER_RUN} ВОПРОСОВ`);
    });

    it('starts with empty statistics', () => {
      expect(statValue('ПОПЫТОК')).toBe('0');
      expect(statValue('ПОСЛЕДНИЙ')).toBe('—');
      expect(statValue('ЛУЧШИЙ')).toBe('—');
      expect(statValue('СРЕДНИЙ')).toBe('—');
    });

    it('shows an empty chart', () => {
      expect(el('app-quiz-chart')).toBeTruthy();
      expect(el('.chart-empty')).toBeTruthy();
    });

    it('hides the reset button while there is no history', () => {
      expect(el('.reset-btn')).toBeNull();
    });
  });

  describe('running a test', () => {
    beforeEach(async () => {
      await start();
    });

    it('swaps the topic screen for the runner', () => {
      expect(el('app-quiz-runner')).toBeTruthy();
      expect(el('.topic-list')).toBeNull();
      expect(el('.start-btn')).toBeNull();
    });

    it('asks 15 questions', () => {
      expect(session.total()).toBe(DEFAULT_QUESTIONS_PER_RUN);
      expect(text('.runner-step')).toBe(`ВОПРОС 1/${DEFAULT_QUESTIONS_PER_RUN}`);
    });

    it('records a right answer and moves on', async () => {
      await answer(true);

      expect(session.correctCount()).toBe(1);
      expect(text('.runner-step')).toBe(`ВОПРОС 2/${DEFAULT_QUESTIONS_PER_RUN}`);
    });

    it('records a wrong answer', async () => {
      await answer(false);

      expect(session.correctCount()).toBe(0);
      expect(session.answeredCount()).toBe(1);
    });

    it('shows the explanation before letting the user move on', async () => {
      all('.option')[0].click();
      await fixture.whenStable();

      expect(el('.feedback-text').textContent!.trim()).not.toBe('');
      expect(el('.next-btn')).toBeTruthy();
    });

    it('leaves the run on a double tap of ВЫЙТИ without recording it', async () => {
      await answer(true);
      await click('.quit-btn');
      await click('.quit-btn');

      expect(el('.topic-list')).toBeTruthy();
      expect(quiz.attempts()).toEqual([]);
    });
  });

  describe('finishing a test', () => {
    beforeEach(async () => {
      await start();
      await playRun(12);
    });

    it('shows the result instead of the runner', () => {
      expect(el('app-quiz-result')).toBeTruthy();
      expect(el('app-quiz-runner')).toBeNull();
      expect(text('.score-value')).toBe('80%');
      expect(text('.score-detail')).toBe(`12 / ${DEFAULT_QUESTIONS_PER_RUN} ВЕРНО`);
    });

    it('stores the attempt', () => {
      expect(quiz.attempts()).toHaveLength(1);
      expect(quiz.attempts()[0]).toMatchObject({ topicId: 'angular', correct: 12, total: 15 });
    });

    it('reviews the missed questions', () => {
      expect(all('.miss')).toHaveLength(3);
    });

    it('draws the fresh attempt on the chart', () => {
      expect(all('.bar')).toHaveLength(1);
      expect(all('.bar')[0].style.height).toBe('80%');
    });

    it('starts another run on ЕЩЁ РАЗ', async () => {
      await click('.again-btn');

      expect(el('app-quiz-runner')).toBeTruthy();
      expect(session.answeredCount()).toBe(0);
      expect(quiz.attempts()).toHaveLength(1);
    });

    it('goes back to the topics on К ТЕМАМ', async () => {
      await click('.close-btn');

      expect(el('.topic-list')).toBeTruthy();
      expect(el('app-quiz-result')).toBeNull();
    });

    it('updates the statistics on the topic screen', async () => {
      await click('.close-btn');

      expect(statValue('ПОПЫТОК')).toBe('1');
      expect(statValue('ПОСЛЕДНИЙ')).toBe('80%');
      expect(statValue('ЛУЧШИЙ')).toBe('80%');
      expect(statValue('СРЕДНИЙ')).toBe('80%');
      expect(text('.topic-best')).toBe('ЛУЧШИЙ 80%');
    });

    it('counts how many runs reached the target', async () => {
      await click('.close-btn');

      expect(text('.on-target-line')).toContain('0 ИЗ 1');
    });
  });

  describe('statistics over several runs', () => {
    beforeEach(async () => {
      await start();
      await playRun(15);
      await click('.close-btn');
      await start();
      await playRun(9);
      await click('.close-btn');
    });

    it('keeps every attempt', () => {
      expect(statValue('ПОПЫТОК')).toBe('2');
    });

    it('averages the runs', () => {
      expect(statValue('СРЕДНИЙ')).toBe('80%'); // 100% and 60%
    });

    it('remembers the best run', () => {
      expect(statValue('ЛУЧШИЙ')).toBe('100%');
      expect(statValue('ПОСЛЕДНИЙ')).toBe('60%');
    });

    it('draws both attempts oldest first', () => {
      expect(all('.bar').map((b) => b.style.height)).toEqual(['100%', '60%']);
    });

    it('counts the run that hit the target', () => {
      expect(text('.on-target-line')).toContain('1 ИЗ 2');
    });

    it('clears the history after a confirmed reset', async () => {
      await click('.reset-btn');
      expect(text('.reset-btn')).toBe('ТОЧНО СБРОСИТЬ?');

      await click('.reset-btn');

      expect(quiz.attempts()).toEqual([]);
      expect(el('.reset-btn')).toBeNull();
      expect(el('.chart-empty')).toBeTruthy();
    });

    it('keeps the history when the reset is not confirmed', async () => {
      await click('.reset-btn');

      expect(quiz.attempts()).toHaveLength(2);
    });
  });

  it('resumes a run that was interrupted', async () => {
    await start();
    await answer(true);
    const drawn = session.questions().map((q) => q.id);
    TestBed.tick();

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [QuizPageComponent] }).compileComponents();
    const resumed = TestBed.inject(QuizSessionService);
    const relaunched = TestBed.createComponent(QuizPageComponent);
    relaunched.autoDetectChanges();
    await relaunched.whenStable();

    expect(relaunched.nativeElement.querySelector('app-quiz-runner')).toBeTruthy();
    expect(resumed.questions().map((q) => q.id)).toEqual(drawn);
    expect(resumed.index()).toBe(1);
    expect(resumed.correctCount()).toBe(1);
  });
});
