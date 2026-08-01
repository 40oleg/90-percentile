import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuizChartComponent } from './quiz-chart.component';
import { QuizAttempt } from '../../models/quiz.model';

function attempt(correct: number, total = 15, id = `a${correct}-${total}`): QuizAttempt {
  return { id, topicId: 'angular', correct, total, at: '2026-01-01T10:00:00.000Z' };
}

@Component({
  standalone: true,
  imports: [QuizChartComponent],
  template: `<app-quiz-chart [attempts]="attempts()" />`,
})
class HostComponent {
  readonly attempts = signal<QuizAttempt[]>([]);
}

describe('QuizChartComponent', () => {
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

  function bars(): HTMLElement[] {
    return Array.from(root().querySelectorAll('.bar'));
  }

  async function setAttempts(attempts: QuizAttempt[]): Promise<void> {
    host.attempts.set(attempts);
    await fixture.whenStable();
  }

  it('shows an empty state without attempts', () => {
    expect(root().querySelector('.chart-empty')!.textContent).toContain('ПОКА НЕТ ПОПЫТОК');
    expect(bars()).toHaveLength(0);
  });

  it('announces the window it draws', () => {
    expect(root().querySelector('.chart-title')!.textContent).toContain('90');
  });

  it('draws one bar per attempt', async () => {
    await setAttempts([attempt(3), attempt(9), attempt(15)]);

    expect(bars()).toHaveLength(3);
    expect(root().querySelector('.chart-count')!.textContent!.trim()).toBe('3');
  });

  it('sizes each bar by its percentage', async () => {
    await setAttempts([attempt(3), attempt(12)]); // 20%, 80%

    expect(bars()[0].style.height).toBe('20%');
    expect(bars()[1].style.height).toBe('80%');
  });

  it('keeps a zero result visible as a stub', async () => {
    await setAttempts([attempt(0)]);

    expect(bars()[0].style.height).toBe('2%');
  });

  it('colours bars by how good the run was', async () => {
    await setAttempts([
      attempt(15), // 100% → high
      attempt(12), // 80%  → mid
      attempt(8), // 53%  → low
      attempt(2), // 13%  → bad
    ]);

    expect(bars().map((b) => b.className.replace('bar ', ''))).toEqual([
      'high',
      'mid',
      'low',
      'bad',
    ]);
  });

  it('treats exactly 90% as on target', async () => {
    await setAttempts([attempt(9, 10)]);

    expect(bars()[0].className).toContain('high');
  });

  it('draws the target line at 90%', () => {
    expect((root().querySelector('.grid-line.target') as HTMLElement).style.bottom).toBe('90%');
  });

  it('labels every bar with its position and score', async () => {
    await setAttempts([attempt(3), attempt(12)]);

    expect(bars()[0].getAttribute('title')).toBe('#1: 20% (3/15)');
    expect(bars()[1].getAttribute('title')).toBe('#2: 80% (12/15)');
  });

  it('describes the chart for screen readers', async () => {
    await setAttempts([attempt(3), attempt(15)]);

    const label = root().querySelector('.plot')!.getAttribute('aria-label')!;
    expect(label).toContain('2 последних попыток');
    expect(label).toContain('лучший 100%');
    expect(label).toContain('последний 100%');
  });

  it('draws a full 90-attempt window', async () => {
    await setAttempts(Array.from({ length: 90 }, (_, i) => attempt(i % 16, 15, `a${i}`)));

    expect(bars()).toHaveLength(90);
  });
});
