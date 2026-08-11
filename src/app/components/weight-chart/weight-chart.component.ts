import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WeightPoint, dayLabel, formatKg } from '../../models/weight-entry.model';

/** viewBox geometry — the SVG scales to the card, the numbers stay in these units. */
const VIEW_W = 300;
const VIEW_H = 132;
const PAD_LEFT = 28;
const PAD_RIGHT = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;

/** Head-room above and below the data, in kilograms. */
const VALUE_PAD = 0.5;
/** Smallest vertical span, so half a kilogram of drift is not a cliff. */
const MIN_SPAN = 2;

/** How many date stamps at most — half a year of days would collide. */
const MAX_X_LABELS = 5;
/** Above this many points the dots merge into a smear, so only the line is drawn. */
const MAX_DOTS = 60;

interface Dot {
  key: number;
  cx: number;
  cy: number;
  label: string;
}

interface AxisLabel {
  text: string;
  y: number;
}

interface XLabel {
  text: string;
  x: number;
  anchor: 'start' | 'middle' | 'end';
}

/**
 * Weight over the chosen stretch of time. The x axis is real time, not a day
 * index, so a month of daily weigh-ins and half a year of odd ones both read
 * honestly.
 */
@Component({
  selector: 'app-weight-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <figcaption class="chart-head">
        <span class="chart-title">ВЕС, КГ</span>
        <span class="chart-count">{{ points().length }} ЗАМ.</span>
      </figcaption>

      @if (hasData()) {
        <svg class="plot" [attr.viewBox]="viewBox" role="img" [attr.aria-label]="summary()">
          @for (line of yLabels(); track line.text) {
            <line
              class="grid-line"
              [attr.x1]="padLeft"
              [attr.x2]="plotRight"
              [attr.y1]="line.y"
              [attr.y2]="line.y"
            />
            <text
              class="axis-text"
              text-anchor="end"
              [attr.x]="padLeft - 3"
              [attr.y]="line.y + 2.5"
            >
              {{ line.text }}
            </text>
          }

          @if (line(); as path) {
            <polyline class="line" [attr.points]="path" />
          }

          @if (showDots()) {
            @for (dot of dots(); track dot.key) {
              <circle class="dot" [attr.cx]="dot.cx" [attr.cy]="dot.cy" r="2.5">
                <title>{{ dot.label }}</title>
              </circle>
            }
          }

          <!-- The newest weigh-in stays marked even on a crowded half-year plot. -->
          @if (lastDot(); as last) {
            <circle class="dot last" [attr.cx]="last.cx" [attr.cy]="last.cy" r="3">
              <title>{{ last.label }}</title>
            </circle>
          }

          @for (label of xLabels(); track label.text) {
            <text
              class="axis-text x"
              [attr.x]="label.x"
              [attr.y]="viewH - 5"
              [attr.text-anchor]="label.anchor"
            >
              {{ label.text }}
            </text>
          }
        </svg>
      } @else {
        <p class="chart-empty">НЕТ ЗАМЕРОВ ЗА ЭТОТ ПЕРИОД</p>
      }
    </figure>
  `,
  styleUrl: './weight-chart.component.scss',
})
export class WeightChartComponent {
  /** Measured days inside the window, oldest first. */
  readonly points = input.required<readonly WeightPoint[]>();
  /** Local midnight of the oldest day the window covers. */
  readonly from = input.required<number>();
  /** Local midnight of today. */
  readonly to = input.required<number>();

  protected readonly viewBox = `0 0 ${VIEW_W} ${VIEW_H}`;
  protected readonly viewH = VIEW_H;
  protected readonly padLeft = PAD_LEFT;
  protected readonly plotRight = VIEW_W - PAD_RIGHT;

  protected readonly hasData = computed(() => this.points().length > 0);

  protected readonly showDots = computed(() => this.points().length <= MAX_DOTS);

  private readonly bounds = computed(() => {
    const values = this.points().map((p) => p.kg);
    if (values.length === 0) return { min: 0, max: MIN_SPAN };

    let min = Math.min(...values) - VALUE_PAD;
    let max = Math.max(...values) + VALUE_PAD;
    if (max - min < MIN_SPAN) {
      const mid = (min + max) / 2;
      min = mid - MIN_SPAN / 2;
      max = mid + MIN_SPAN / 2;
    }
    return { min: Math.max(0, min), max };
  });

  protected readonly yLabels = computed<AxisLabel[]>(() => {
    const { min, max } = this.bounds();
    const mid = (min + max) / 2;
    return [max, mid, min].map((value) => ({ text: formatKg(value), y: this.y(value) }));
  });

  /**
   * Stamps sit at even fractions of the window rather than on the weigh-ins
   * themselves: half a year of irregular measurements would otherwise pile all
   * the dates into whichever weeks happen to be dense.
   */
  protected readonly xLabels = computed<XLabel[]>(() => {
    if (this.points().length === 0) return [];

    const from = this.from();
    const to = this.to();
    const gaps = MAX_X_LABELS - 1;

    return Array.from({ length: MAX_X_LABELS }, (_, i) => {
      const at = from + ((to - from) * i) / gaps;
      const anchor = i === 0 ? 'start' : i === gaps ? 'end' : 'middle';
      return { text: dayLabel(at), x: this.x(at), anchor };
    });
  });

  protected readonly dots = computed<Dot[]>(() =>
    this.points().map((point) => ({
      key: point.dayStart,
      cx: this.x(point.dayStart),
      cy: this.y(point.kg),
      label: `${point.label} · ${formatKg(point.kg)} кг`,
    })),
  );

  protected readonly lastDot = computed<Dot | null>(() => this.dots().at(-1) ?? null);

  protected readonly line = computed(() => {
    const dots = this.dots();
    if (dots.length < 2) return null;
    return dots.map((dot) => `${dot.cx},${dot.cy}`).join(' ');
  });

  protected readonly summary = computed(() => {
    const points = this.points();
    if (points.length === 0) return 'График веса пуст';

    const first = points[0];
    const last = points[points.length - 1];
    const change = last.kg - first.kg;
    const direction = change === 0 ? 'без изменений' : `${change > 0 ? 'плюс' : 'минус'}`;

    return (
      `График веса: ${points.length} замеров. ` +
      `С ${first.label} по ${last.label}: с ${formatKg(first.kg)} до ${formatKg(last.kg)} кг, ` +
      `${direction}${change === 0 ? '' : ' ' + formatKg(Math.abs(change)) + ' кг'}.`
    );
  });

  private x(dayStart: number): number {
    const from = this.from();
    const span = this.to() - from;
    const width = VIEW_W - PAD_LEFT - PAD_RIGHT;
    if (span <= 0) return PAD_LEFT + width;
    const ratio = Math.min(1, Math.max(0, (dayStart - from) / span));
    return round(PAD_LEFT + ratio * width);
  }

  private y(kg: number): number {
    const { min, max } = this.bounds();
    const height = VIEW_H - PAD_TOP - PAD_BOTTOM;
    const ratio = (kg - min) / (max - min);
    return round(PAD_TOP + (1 - ratio) * height);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
