import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuizRunnerComponent } from './quiz-runner.component';
import { DONT_KNOW_OPTION, SessionQuestion } from '../../models/quiz.model';

/** Shaped like a real run: four answers with «НЕ ЗНАЮ» appended by the session. */
function question(n: number, answeredIndex: number | null = null): SessionQuestion {
  return {
    id: `q${n}`,
    prompt: `Вопрос ${n}?`,
    options: [`ответ ${n}A`, `ответ ${n}B`, `ответ ${n}C`, `ответ ${n}D`, DONT_KNOW_OPTION],
    correctIndex: 1,
    explanation: `объяснение ${n}`,
    answeredIndex,
  };
}

/** Index of the «НЕ ЗНАЮ» button — always the last one. */
const DONT_KNOW = 4;

@Component({
  standalone: true,
  imports: [QuizRunnerComponent],
  template: `
    <app-quiz-runner
      [questions]="questions()"
      [index]="index()"
      (answered)="answered.push($event)"
      (advanced)="advanced = advanced + 1"
      (quit)="quits = quits + 1"
    />
  `,
})
class HostComponent {
  readonly questions = signal<SessionQuestion[]>([question(1), question(2), question(3)]);
  readonly index = signal(0);
  answered: number[] = [];
  advanced = 0;
  quits = 0;
}

describe('QuizRunnerComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function el<T extends HTMLElement>(selector: string): T {
    return root().querySelector(selector) as T;
  }

  function options(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll('.option'));
  }

  function text(selector: string): string {
    return el(selector)?.textContent?.trim() ?? '';
  }

  /** Marks the current question as answered, the way the session service would. */
  async function answerWith(optionIndex: number): Promise<void> {
    host.questions.update((all) =>
      all.map((q, i) => (i === host.index() ? { ...q, answeredIndex: optionIndex } : q)),
    );
    await fixture.whenStable();
  }

  it('shows the prompt of the current question', () => {
    expect(text('.prompt')).toBe('Вопрос 1?');
  });

  it('shows the position in the run', () => {
    expect(text('.runner-step')).toBe('ВОПРОС 1/3');
  });

  it('renders the four answers plus «НЕ ЗНАЮ» with pixel letters', () => {
    expect(options()).toHaveLength(5);
    expect(options().map((b) => b.querySelector('.option-key')!.textContent!.trim())).toEqual([
      'А',
      'Б',
      'В',
      'Г',
      'Д',
    ]);
    expect(options()[0].querySelector('.option-text')!.textContent!.trim()).toBe('ответ 1A');
  });

  it('emits the index of the tapped option', () => {
    options()[2].click();

    expect(host.answered).toEqual([2]);
  });

  it('shows no feedback and no next button before answering', () => {
    expect(el('.feedback')).toBeNull();
    expect(el('.next-btn')).toBeNull();
  });

  it('marks the right option and the wrong pick after answering', async () => {
    await answerWith(0);

    expect(options()[1].className).toContain('correct');
    expect(options()[0].className).toContain('wrong');
    expect(options()[2].className).toContain('muted');
  });

  it('marks only the right option when the answer was correct', async () => {
    await answerWith(1);

    expect(options()[1].className).toContain('correct');
    expect(options().filter((b) => b.className.includes('wrong'))).toHaveLength(0);
  });

  it('locks the options once answered', async () => {
    await answerWith(1);
    options()[3].click();

    expect(options().every((b) => b.disabled)).toBe(true);
    expect(host.answered).toEqual([]);
  });

  it('explains a right answer', async () => {
    await answerWith(1);

    expect(text('.feedback-title')).toBe('ВЕРНО');
    expect(el('.feedback').className).toContain('ok');
    expect(text('.feedback-text')).toBe('объяснение 1');
  });

  it('explains a wrong answer', async () => {
    await answerWith(3);

    expect(text('.feedback-title')).toBe('НЕВЕРНО');
    expect(el('.feedback').className).not.toContain('ok');
  });

  it('offers the next question in the middle of a run', async () => {
    await answerWith(1);

    expect(text('.next-btn')).toBe('ДАЛЬШЕ');
    el<HTMLButtonElement>('.next-btn').click();
    expect(host.advanced).toBe(1);
  });

  it('offers the result on the last question', async () => {
    host.index.set(2);
    await fixture.whenStable();
    await answerWith(1);

    expect(text('.next-btn')).toBe('РЕЗУЛЬТАТ');
  });

  it('counts the right answers so far', async () => {
    await answerWith(1);

    expect(text('.runner-score')).toContain('1');
  });

  describe('progress segments', () => {
    function segmentClasses(): string[] {
      return Array.from(root().querySelectorAll('.segment')).map((s) => s.className);
    }

    it('draws one segment per question', () => {
      expect(segmentClasses()).toHaveLength(3);
    });

    it('marks the current question', () => {
      expect(segmentClasses()[0]).toContain('current');
      expect(segmentClasses()[1]).toContain('todo');
    });

    it('marks answered questions right or wrong', async () => {
      await answerWith(1);
      host.index.set(1);
      await fixture.whenStable();
      await answerWith(0);

      expect(segmentClasses()[0]).toContain('correct');
      expect(segmentClasses()[1]).toContain('wrong');
      expect(segmentClasses()[2]).toContain('todo');
    });
  });

  describe('quitting', () => {
    it('asks for confirmation on the first tap', () => {
      el<HTMLButtonElement>('.quit-btn').click();
      fixture.detectChanges();

      expect(host.quits).toBe(0);
      expect(text('.quit-btn')).toBe('ТОЧНО?');
    });

    it('quits on the second tap', async () => {
      el<HTMLButtonElement>('.quit-btn').click();
      await fixture.whenStable();
      el<HTMLButtonElement>('.quit-btn').click();
      await fixture.whenStable();

      expect(host.quits).toBe(1);
      expect(text('.quit-btn')).toBe('ВЫЙТИ');
    });

    it('forgets the confirmation when the question changes', async () => {
      el<HTMLButtonElement>('.quit-btn').click();
      await fixture.whenStable();

      host.index.set(1);
      await fixture.whenStable();

      expect(text('.quit-btn')).toBe('ВЫЙТИ');
    });
  });

  describe('«НЕ ЗНАЮ»', () => {
    it('stands apart from the four answers', () => {
      expect(options()[DONT_KNOW].textContent).toContain(DONT_KNOW_OPTION);
      expect(options()[DONT_KNOW].className).toContain('dont-know');
      expect(options()[0].className).not.toContain('dont-know');
    });

    it('reports the pick like any other option', async () => {
      options()[DONT_KNOW].click();
      await fixture.whenStable();

      expect(host.answered).toEqual([DONT_KNOW]);
    });

    it('is marked as a skip, not as a wrong answer', async () => {
      await answerWith(DONT_KNOW);

      expect(options()[DONT_KNOW].className).toContain('skipped');
      expect(options()[DONT_KNOW].className).not.toContain('wrong');
    });

    it('still reveals the right answer', async () => {
      await answerWith(DONT_KNOW);

      expect(options()[1].className).toContain('correct');
    });

    it('is answered with a gentler verdict than a wrong pick', async () => {
      await answerWith(DONT_KNOW);

      expect(text('.feedback-title')).toBe('НЕ СТРАШНО');
      expect(el('.feedback').className).toContain('skipped');
      expect(text('.feedback-text')).toBe('объяснение 1');
    });

    it('says НЕВЕРНО for an actual wrong answer', async () => {
      await answerWith(0);

      expect(text('.feedback-title')).toBe('НЕВЕРНО');
      expect(el('.feedback').className).not.toContain('skipped');
    });

    it('does not count towards the score', async () => {
      await answerWith(DONT_KNOW);

      expect(text('.runner-score')).toContain('0');
    });

    it('leaves the run segment marked as a miss', async () => {
      await answerWith(DONT_KNOW);

      const segments = Array.from(root().querySelectorAll('.segment'));
      expect(segments[0].className).toContain('wrong');
    });
  });

  it('renders nothing when the index is out of range', async () => {
    host.index.set(9);
    await fixture.whenStable();

    expect(el('.runner')).toBeNull();
  });

  it('uses buttons of type=button so it never submits a form', () => {
    for (const button of root().querySelectorAll('button')) {
      expect(button.getAttribute('type')).toBe('button');
    }
  });
});
