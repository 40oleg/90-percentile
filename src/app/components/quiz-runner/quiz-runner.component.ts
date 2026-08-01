import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { SessionQuestion } from '../../models/quiz.model';

type OptionState = 'idle' | 'correct' | 'wrong' | 'muted';
type SegmentState = 'correct' | 'wrong' | 'current' | 'todo';

/** The question screen: prompt, four options, feedback, next. */
@Component({
  selector: 'app-quiz-runner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-runner.component.html',
  styleUrl: './quiz-runner.component.scss',
})
export class QuizRunnerComponent {
  readonly questions = input.required<readonly SessionQuestion[]>();
  readonly index = input.required<number>();

  readonly answered = output<number>();
  readonly advanced = output<void>();
  readonly quit = output<void>();

  protected readonly letters = ['А', 'Б', 'В', 'Г'] as const;

  protected readonly current = computed<SessionQuestion | null>(
    () => this.questions()[this.index()] ?? null,
  );
  protected readonly total = computed(() => this.questions().length);
  protected readonly isLast = computed(() => this.index() >= this.total() - 1);
  protected readonly isAnswered = computed(() => this.current()?.answeredIndex != null);
  protected readonly isCorrect = computed(() => {
    const question = this.current();
    return !!question && question.answeredIndex === question.correctIndex;
  });
  protected readonly correctCount = computed(
    () => this.questions().filter((q) => q.answeredIndex === q.correctIndex).length,
  );

  protected readonly segments = computed<SegmentState[]>(() =>
    this.questions().map((question, i) => {
      if (question.answeredIndex === null) return i === this.index() ? 'current' : 'todo';
      return question.answeredIndex === question.correctIndex ? 'correct' : 'wrong';
    }),
  );

  /** Leaving a run mid-way needs a second tap — no accidental loss of progress. */
  protected readonly confirmQuit = signal(false);

  constructor() {
    effect(() => {
      this.index();
      this.confirmQuit.set(false);
    });
  }

  protected optionState(optionIndex: number): OptionState {
    const question = this.current();
    if (!question || question.answeredIndex === null) return 'idle';
    if (optionIndex === question.correctIndex) return 'correct';
    if (optionIndex === question.answeredIndex) return 'wrong';
    return 'muted';
  }

  protected onAnswer(optionIndex: number): void {
    if (this.isAnswered()) return;
    this.answered.emit(optionIndex);
  }

  protected onQuit(): void {
    if (!this.confirmQuit()) {
      this.confirmQuit.set(true);
      return;
    }
    this.confirmQuit.set(false);
    this.quit.emit();
  }
}
