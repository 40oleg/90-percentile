import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { QuizAttempt, scorePercent } from '../../models/quiz.model';
import { CHART_ATTEMPTS, TARGET_PERCENT } from '../../services/quiz.service';

interface Bar {
  id: string;
  percent: number;
  /** Drawn height — a 0% run still gets a visible stub. */
  height: number;
  tier: 'high' | 'mid' | 'low' | 'bad';
  label: string;
}

function tierOf(percent: number): Bar['tier'] {
  if (percent >= TARGET_PERCENT) return 'high';
  if (percent >= 70) return 'mid';
  if (percent >= 40) return 'low';
  return 'bad';
}

/** Percent-per-attempt bar chart: oldest attempt on the left, newest on the right. */
@Component({
  selector: 'app-quiz-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <figcaption class="chart-head">
        <span class="chart-title">ПОСЛЕДНИЕ {{ capacity() }} ПОПЫТОК</span>
        <span class="chart-count">{{ bars().length }}</span>
      </figcaption>

      <div class="plot-row">
        <!-- Only the target and the floor are labelled: the plot tops out at
             100% anyway, and a third label crowds a 6rem-tall chart. -->
        <div class="axis-y" aria-hidden="true">
          <span class="axis-target" [style.bottom.%]="target()">{{ target() }}</span>
          <span class="axis-bottom">0</span>
        </div>

        <div class="plot" role="img" [attr.aria-label]="summary()">
          <span class="grid-line target" [style.bottom.%]="target()"></span>

          @if (bars().length > 0) {
            <div class="bars">
              @for (bar of bars(); track bar.id) {
                <span
                  class="bar"
                  [class]="'bar ' + bar.tier"
                  [style.height.%]="bar.height"
                  [attr.title]="bar.label"
                ></span>
              }
            </div>
          } @else {
            <p class="chart-empty">ПОКА НЕТ ПОПЫТОК</p>
          }
        </div>
      </div>
    </figure>
  `,
  styleUrl: './quiz-chart.component.scss',
})
export class QuizChartComponent {
  /** Attempts in chart order: oldest first. */
  readonly attempts = input.required<readonly QuizAttempt[]>();
  readonly capacity = input(CHART_ATTEMPTS);
  readonly target = input(TARGET_PERCENT);

  protected readonly bars = computed<Bar[]>(() =>
    this.attempts().map((attempt, i) => {
      const percent = scorePercent(attempt.correct, attempt.total);
      return {
        id: attempt.id || `attempt-${i}`,
        percent,
        height: Math.max(percent, 2),
        tier: tierOf(percent),
        label: `#${i + 1}: ${percent}% (${attempt.correct}/${attempt.total})`,
      };
    }),
  );

  protected readonly summary = computed(() => {
    const bars = this.bars();
    if (bars.length === 0) return 'График попыток пуст';
    const percents = bars.map((b) => b.percent);
    const average = Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length);
    return (
      `График ${bars.length} последних попыток. ` +
      `Средний результат ${average}%, лучший ${Math.max(...percents)}%, ` +
      `последний ${percents[percents.length - 1]}%.`
    );
  });
}
