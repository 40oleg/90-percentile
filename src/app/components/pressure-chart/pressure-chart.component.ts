import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PressureDayPoint } from '../../models/pressure-entry.model';

/** viewBox geometry — the SVG scales to the card, the numbers stay in these units. */
const VIEW_W = 300;
const VIEW_H = 132;
const PAD_LEFT = 24;
const PAD_RIGHT = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;

/** Head-room around the data so the extremes never sit on the frame. */
const VALUE_PAD = 8;
/** Smallest vertical span, so a flat week is not amplified into a mountain range. */
const MIN_SPAN = 40;

/** How many x labels at most — 14 day stamps would collide on a phone. */
const MAX_X_LABELS = 5;

export type SeriesKey = 'systolic' | 'diastolic' | 'pulse';

interface Dot {
  key: string;
  cx: number;
  cy: number;
  label: string;
}

interface Series {
  key: SeriesKey;
  label: string;
  /** Polylines of consecutive measured days; a skipped day breaks the line. */
  segments: string[];
  dots: Dot[];
}

interface AxisLabel {
  value: number;
  y: number;
}

interface XLabel {
  text: string;
  x: number;
  /** Edge labels hug the frame instead of centring, so they are never clipped. */
  anchor: 'start' | 'middle' | 'end';
}

const SERIES_LABELS: Record<SeriesKey, string> = {
  systolic: 'ВЕРХ',
  diastolic: 'НИЗ',
  pulse: 'ПУЛЬС',
};

const SERIES_ORDER: readonly SeriesKey[] = ['systolic', 'diastolic', 'pulse'];

/**
 * Day-by-day line chart of one slot: upper, lower and pulse on a shared scale.
 * Oldest day on the left, today on the right.
 */
@Component({
  selector: 'app-pressure-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="chart">
      <figcaption class="chart-head">
        <span class="chart-title">{{ title() }}</span>
        <span class="chart-days">{{ measuredDays() }}/{{ points().length }} ДН.</span>
      </figcaption>

      @if (hasData()) {
        <svg class="plot" [attr.viewBox]="viewBox" role="img" [attr.aria-label]="summary()">
          @for (line of yLabels(); track line.value) {
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
              {{ line.value }}
            </text>
          }

          @for (series of seriesList(); track series.key) {
            @for (segment of series.segments; track $index) {
              <polyline [class]="'line ' + series.key" [attr.points]="segment" />
            }
            @for (dot of series.dots; track dot.key) {
              <circle [class]="'dot ' + series.key" [attr.cx]="dot.cx" [attr.cy]="dot.cy" r="2.5">
                <title>{{ dot.label }}</title>
              </circle>
            }
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
        <p class="chart-empty">НЕТ ЗАМЕРОВ</p>
      }

      <div class="legend" aria-hidden="true">
        @for (series of legend; track series.key) {
          <span class="legend-item">
            <span [class]="'legend-swatch ' + series.key"></span>
            {{ series.label }}
          </span>
        }
      </div>
    </figure>
  `,
  styleUrl: './pressure-chart.component.scss',
})
export class PressureChartComponent {
  /** Chart heading, e.g. `УТРО`. */
  readonly title = input.required<string>();
  /** One point per day of the window: oldest first, gaps carried as nulls. */
  readonly points = input.required<readonly PressureDayPoint[]>();

  protected readonly viewBox = `0 0 ${VIEW_W} ${VIEW_H}`;
  protected readonly viewH = VIEW_H;
  protected readonly padLeft = PAD_LEFT;
  protected readonly plotRight = VIEW_W - PAD_RIGHT;

  protected readonly legend = SERIES_ORDER.map((key) => ({ key, label: SERIES_LABELS[key] }));

  protected readonly measuredDays = computed(() => this.points().filter((p) => p.count > 0).length);

  protected readonly hasData = computed(() => this.measuredDays() > 0);

  /** Rounded-out value bounds shared by all three lines. */
  private readonly bounds = computed(() => {
    const values: number[] = [];
    for (const point of this.points()) {
      if (point.systolic !== null) values.push(point.systolic, point.diastolic!, point.pulse!);
    }
    if (values.length === 0) return { min: 0, max: MIN_SPAN };

    let min = Math.floor((Math.min(...values) - VALUE_PAD) / 10) * 10;
    let max = Math.ceil((Math.max(...values) + VALUE_PAD) / 10) * 10;
    min = Math.max(0, min);
    if (max - min < MIN_SPAN) max = min + MIN_SPAN;
    return { min, max };
  });

  protected readonly yLabels = computed<AxisLabel[]>(() => {
    const { min, max } = this.bounds();
    const mid = Math.round((min + max) / 2 / 10) * 10;
    const values = mid > min && mid < max ? [max, mid, min] : [max, min];
    return values.map((value) => ({ value, y: this.y(value) }));
  });

  protected readonly xLabels = computed<XLabel[]>(() => {
    const points = this.points();
    if (points.length === 0) return [];

    const step = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));
    const labels: XLabel[] = [];
    // Walk back from the last day, so today is always stamped.
    for (let i = points.length - 1; i >= 0; i -= step) {
      const x = this.x(i);
      const anchor = i === points.length - 1 ? 'end' : i === 0 ? 'start' : 'middle';
      labels.unshift({ text: points[i].label, x, anchor });
    }
    return labels;
  });

  protected readonly seriesList = computed<Series[]>(() =>
    SERIES_ORDER.map((key) => this.buildSeries(key)),
  );

  protected readonly summary = computed(() => {
    const measured = this.points().filter((p) => p.count > 0);
    if (measured.length === 0) return `${this.title()}: замеров нет`;

    const last = measured[measured.length - 1];
    const avg = (pick: SeriesKey) =>
      Math.round(measured.reduce((sum, p) => sum + p[pick]!, 0) / measured.length);

    return (
      `${this.title()}: ${measured.length} дн. с замерами. ` +
      `Среднее ${avg('systolic')} на ${avg('diastolic')}, пульс ${avg('pulse')}. ` +
      `Последний замер ${last.label}: ${last.systolic} на ${last.diastolic}, пульс ${last.pulse}.`
    );
  });

  private buildSeries(key: SeriesKey): Series {
    const points = this.points();
    const segments: string[] = [];
    const dots: Dot[] = [];
    let run: string[] = [];

    points.forEach((point, i) => {
      const value = point[key];
      if (value === null) {
        if (run.length > 1) segments.push(run.join(' '));
        run = [];
        return;
      }

      const cx = this.x(i);
      const cy = this.y(value);
      run.push(`${cx},${cy}`);
      dots.push({
        key: `${key}-${point.dayStart}`,
        cx,
        cy,
        label: `${point.label} · ${SERIES_LABELS[key]} ${value}`,
      });
    });
    if (run.length > 1) segments.push(run.join(' '));

    return { key, label: SERIES_LABELS[key], segments, dots };
  }

  private x(index: number): number {
    const count = this.points().length;
    const width = VIEW_W - PAD_LEFT - PAD_RIGHT;
    if (count <= 1) return PAD_LEFT + width / 2;
    return round(PAD_LEFT + (index * width) / (count - 1));
  }

  private y(value: number): number {
    const { min, max } = this.bounds();
    const height = VIEW_H - PAD_TOP - PAD_BOTTOM;
    const ratio = (value - min) / (max - min);
    return round(PAD_TOP + (1 - ratio) * height);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
