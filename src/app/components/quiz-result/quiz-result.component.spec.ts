import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuizResultComponent } from './quiz-result.component';
import { SessionQuestion } from '../../models/quiz.model';

function miss(n: number): SessionQuestion {
  return {
    id: `q${n}`,
    prompt: `Вопрос ${n}?`,
    options: [`первый ${n}`, `второй ${n}`, `третий ${n}`, `четвёртый ${n}`],
    correctIndex: 2,
    explanation: `объяснение ${n}`,
    answeredIndex: 0,
  };
}

@Component({
  standalone: true,
  imports: [QuizResultComponent],
  template: `
    <app-quiz-result
      [correct]="correct()"
      [total]="total()"
      [mistakes]="mistakes()"
      [topicTitle]="'ANGULAR'"
      (again)="agains = agains + 1"
      (closed)="closes = closes + 1"
    />
  `,
})
class HostComponent {
  readonly correct = signal(12);
  readonly total = signal(15);
  readonly mistakes = signal<SessionQuestion[]>([miss(1), miss(2), miss(3)]);
  agains = 0;
  closes = 0;
}

describe('QuizResultComponent', () => {
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

  function text(selector: string): string {
    return el(selector)?.textContent?.trim() ?? '';
  }

  async function score(correct: number, total = 15): Promise<void> {
    host.correct.set(correct);
    host.total.set(total);
    await fixture.whenStable();
  }

  it('shows the score as a percentage', () => {
    expect(text('.score-value')).toBe('80%');
  });

  it('shows the raw score too', () => {
    expect(text('.score-detail')).toBe('12 / 15 ВЕРНО');
  });

  it('names the topic', () => {
    expect(text('.score-caption')).toContain('ANGULAR');
  });

  it('rounds the percentage', async () => {
    await score(11);

    expect(text('.score-value')).toBe('73%');
  });

  it('marks a run at or above 90% as on target', async () => {
    await score(14); // 93%

    expect(el('.score-value').className).toContain('on-target');
    expect(text('.score-verdict')).toBe('ТЫ В 90 ПЕРЦЕНТИЛЕ');
  });

  it('does not mark 80% as on target', () => {
    expect(el('.score-value').className).not.toContain('on-target');
    expect(text('.score-verdict')).toBe('БЛИЗКО, ДОЖМИ');
  });

  it.each([
    [15, 'ТЫ В 90 ПЕРЦЕНТИЛЕ'],
    [11, 'БЛИЗКО, ДОЖМИ'],
    [7, 'ЕСТЬ ЧТО ПОДТЯНУТЬ'],
    [2, 'ПОВТОРИ ТЕОРИЮ'],
  ])('judges %i correct answers as "%s"', async (correct, verdict) => {
    await score(correct);

    expect(text('.score-verdict')).toBe(verdict);
  });

  it('fills the bar to the score', () => {
    expect(el('.score-fill').style.width).toBe('80%');
  });

  it('reviews every mistake', () => {
    expect(root().querySelectorAll('.miss')).toHaveLength(3);
    expect(text('.miss-prompt')).toBe('Вопрос 1?');
  });

  it('shows the given answer next to the right one', () => {
    const first = el('.miss');
    expect(first.querySelector('.miss-line.wrong')!.textContent).toContain('первый 1');
    expect(first.querySelector('.miss-line.ok')!.textContent).toContain('третий 1');
    expect(first.querySelector('.miss-why')!.textContent!.trim()).toBe('объяснение 1');
  });

  it('handles a question that was never answered', async () => {
    host.mistakes.set([{ ...miss(9), answeredIndex: null }]);
    await fixture.whenStable();

    expect(el('.miss-line.wrong').textContent).toContain('—');
  });

  it('celebrates a clean sheet instead of an empty review', async () => {
    host.mistakes.set([]);
    await fixture.whenStable();

    expect(el('.review')).toBeNull();
    expect(text('.clean-sheet')).toContain('НИ ОДНОЙ ОШИБКИ');
  });

  it('emits when the user wants another run', () => {
    el<HTMLButtonElement>('.again-btn').click();

    expect(host.agains).toBe(1);
  });

  it('emits when the user goes back to the topics', () => {
    el<HTMLButtonElement>('.close-btn').click();

    expect(host.closes).toBe(1);
  });

  it('never divides by zero on an empty run', async () => {
    await score(0, 0);

    expect(text('.score-value')).toBe('0%');
  });
});
