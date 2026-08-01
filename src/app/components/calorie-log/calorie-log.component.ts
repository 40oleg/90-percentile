import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CalorieEntry } from '../../models/calorie-entry.model';

/** Row height in px — the virtual window math depends on it, so the SCSS must match. */
export const ROW_HEIGHT = 44;

/** Visible window height in px (≈5 rows) — the list stays compact under the input. */
export const VIEWPORT_HEIGHT = 220;

/** Rows rendered above/below the window so fast scrolling doesn't flash blanks. */
export const OVERSCAN = 3;

const PAD = (n: number) => String(n).padStart(2, '0');

/** `01.08 · 14:05` — short enough for a pixel-font row. */
export function formatEntryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return `${PAD(date.getDate())}.${PAD(date.getMonth() + 1)} · ${PAD(date.getHours())}:${PAD(date.getMinutes())}`;
}

/**
 * Virtual-scrolling log of calorie entries: only the rows inside the viewport
 * (plus a small overscan) exist in the DOM, so a log of thousands of entries
 * costs the same as a log of ten.
 */
@Component({
  selector: 'app-calorie-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calorie-log.component.html',
  styleUrl: './calorie-log.component.scss',
})
export class CalorieLogComponent {
  readonly entries = input.required<readonly CalorieEntry[]>();
  readonly removed = output<string>();

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly viewportHeight = VIEWPORT_HEIGHT;

  private readonly scrollTop = signal(0);

  protected readonly totalHeight = computed(() => this.entries().length * ROW_HEIGHT);

  /** Scroll offset clamped to the content — a shrinking list can't strand the window. */
  private readonly clampedScrollTop = computed(() => {
    const maxScroll = Math.max(0, this.totalHeight() - VIEWPORT_HEIGHT);
    return Math.min(Math.max(0, this.scrollTop()), maxScroll);
  });

  protected readonly startIndex = computed(() =>
    Math.max(0, Math.floor(this.clampedScrollTop() / ROW_HEIGHT) - OVERSCAN),
  );

  protected readonly endIndex = computed(() =>
    Math.min(
      this.entries().length,
      Math.ceil((this.clampedScrollTop() + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN,
    ),
  );

  protected readonly visibleEntries = computed(() =>
    this.entries().slice(this.startIndex(), this.endIndex()),
  );

  protected readonly offsetY = computed(() => this.startIndex() * ROW_HEIGHT);

  protected onScroll(event: Event): void {
    this.scrollTop.set((event.target as HTMLElement).scrollTop);
  }

  protected onRemove(id: string): void {
    this.removed.emit(id);
  }

  protected formatDate(iso: string): string {
    return formatEntryDate(iso);
  }
}
