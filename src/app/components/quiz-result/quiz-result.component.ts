import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SessionQuestion, scorePercent } from '../../models/quiz.model';
import { TARGET_PERCENT } from '../../services/quiz.service';

/** The score screen shown right after a run, with a review of the misses. */
@Component({
  selector: 'app-quiz-result',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-result.component.html',
  styleUrl: './quiz-result.component.scss',
})
export class QuizResultComponent {
  readonly correct = input.required<number>();
  readonly total = input.required<number>();
  readonly mistakes = input.required<readonly SessionQuestion[]>();
  readonly topicTitle = input('');

  readonly again = output<void>();
  readonly closed = output<void>();

  protected readonly target = TARGET_PERCENT;

  protected readonly percent = computed(() => scorePercent(this.correct(), this.total()));
  protected readonly onTarget = computed(() => this.percent() >= TARGET_PERCENT);

  protected readonly verdict = computed(() => {
    const percent = this.percent();
    if (percent >= TARGET_PERCENT) return 'ТЫ В 90 ПЕРЦЕНТИЛЕ';
    if (percent >= 70) return 'БЛИЗКО, ДОЖМИ';
    if (percent >= 40) return 'ЕСТЬ ЧТО ПОДТЯНУТЬ';
    return 'ПОВТОРИ ТЕОРИЮ';
  });

  protected answerText(question: SessionQuestion): string {
    const index = question.answeredIndex;
    return index === null ? '—' : question.options[index];
  }

  protected correctText(question: SessionQuestion): string {
    return question.options[question.correctIndex];
  }
}
