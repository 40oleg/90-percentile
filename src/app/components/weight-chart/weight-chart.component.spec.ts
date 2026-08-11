import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { WeightChartComponent } from './weight-chart.component';
import { WeightPoint, dayLabel } from '../../models/weight-entry.model';

/** Local midnight `daysAgo` days before today. */
function day(daysAgo: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}

function point(daysAgo: number, kg: number): WeightPoint {
  const dayStart = day(daysAgo);
  return { dayStart, label: dayLabel(dayStart), kg, count: 1 };
}

@Component({
  standalone: true,
  imports: [WeightChartComponent],
  template: `<app-weight-chart [points]="points()" [from]="from()" [to]="to()" />`,
})
class HostComponent {
  readonly points = signal<WeightPoint[]>([]);
  readonly from = signal(day(29));
  readonly to = signal(day(0));
}

describe('WeightChartComponent', () => {
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

  function el<T extends Element>(selector: string): T | null {
    return root().querySelector<T>(selector);
  }

  function all(selector: string): Element[] {
    return Array.from(root().querySelectorAll(selector));
  }

  function linePoints(): { x: number; y: number }[] {
    const raw = el('polyline.line')?.getAttribute('points');
    if (!raw) return [];
    return raw.split(' ').map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return { x, y };
    });
  }

  async function setPoints(points: WeightPoint[]): Promise<void> {
    host.points.set(points);
    await fixture.whenStable();
  }

  describe('empty state', () => {
    it('shows a placeholder with no weigh-ins', () => {
      expect(el('.chart-empty')!.textContent!.trim()).toBe('НЕТ ЗАМЕРОВ ЗА ЭТОТ ПЕРИОД');
      expect(el('svg.plot')).toBeNull();
    });

    it('counts the weigh-ins in the header', async () => {
      expect(el('.chart-count')!.textContent!.trim()).toBe('0 ЗАМ.');

      await setPoints([point(2, 80), point(0, 79)]);

      expect(el('.chart-count')!.textContent!.trim()).toBe('2 ЗАМ.');
    });
  });

  describe('plotting', () => {
    beforeEach(async () => {
      await setPoints([point(20, 80), point(10, 78), point(0, 79)]);
    });

    it('draws one line through the weigh-ins', () => {
      expect(all('polyline.line')).toHaveLength(1);
      expect(linePoints()).toHaveLength(3);
    });

    it('walks the days left to right', () => {
      const xs = linePoints().map((p) => p.x);

      expect(xs[0]).toBeLessThan(xs[1]);
      expect(xs[1]).toBeLessThan(xs[2]);
    });

    it('spaces the days by real time, not by index', () => {
      const [a, b, c] = linePoints().map((p) => p.x);

      // 20 days → 10 days → today: the first gap is as wide as the second.
      expect(b - a).toBeCloseTo(c - b, 1);
    });

    it('puts a heavier day higher up the plot', () => {
      const [a, b] = linePoints().map((p) => p.y);

      // 80 kg then 78 kg, and y grows downwards.
      expect(a).toBeLessThan(b);
    });

    it('marks every weigh-in with a dot', () => {
      // Three points plus the highlighted newest one.
      expect(all('circle.dot')).toHaveLength(4);
      expect(all('circle.dot.last')).toHaveLength(1);
    });

    it('names the day and the weight on every dot', () => {
      const titles = all('circle.dot title').map((t) => t.textContent!.trim());

      expect(titles[0]).toBe(`${dayLabel(day(20))} · 80 кг`);
    });

    it('describes the chart for screen readers', () => {
      const label = el('svg.plot')!.getAttribute('aria-label')!;

      expect(label).toContain('3 замеров');
      expect(label).toContain('с 80 до 79 кг');
      expect(label).toContain('минус 1 кг');
    });
  });

  describe('a single weigh-in', () => {
    beforeEach(async () => {
      await setPoints([point(5, 74.5)]);
    });

    it('draws no line', () => {
      expect(all('polyline.line')).toHaveLength(0);
    });

    it('still marks the day', () => {
      expect(all('circle.dot')).toHaveLength(2);
      expect(el('circle.dot title')!.textContent!.trim()).toContain('74.5 кг');
    });
  });

  describe('axes', () => {
    it('brackets the weights with rounded labels', async () => {
      await setPoints([point(10, 78), point(0, 80)]);

      const values = all('.axis-text:not(.x)').map((t) => Number(t.textContent!.trim()));

      expect(Math.max(...values)).toBeGreaterThanOrEqual(80);
      expect(Math.min(...values)).toBeLessThanOrEqual(78);
    });

    it('opens up the scale when the weight barely moves', async () => {
      await setPoints([point(10, 74.5), point(0, 74.6)]);

      const values = all('.axis-text:not(.x)').map((t) => Number(t.textContent!.trim()));

      // A tenth of a kilogram must not fill the whole plot.
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThanOrEqual(1.9);
    });

    it('stamps the window evenly, whenever the weigh-ins happened', async () => {
      await setPoints([point(3, 80), point(2, 79.5), point(0, 79)]);

      const labels = all('.axis-text.x').map((t) => t.textContent!.trim());

      expect(labels).toHaveLength(5);
      expect(labels[0]).toBe(dayLabel(host.from()));
      expect(labels.at(-1)).toBe(dayLabel(host.to()));
    });

    it('follows the window when the range changes', async () => {
      await setPoints([point(0, 79)]);
      host.from.set(day(179));
      await fixture.whenStable();

      expect(all('.axis-text.x')[0].textContent!.trim()).toBe(dayLabel(day(179)));
    });
  });

  describe('a crowded window', () => {
    it('drops the per-day dots but keeps the line and the newest mark', async () => {
      await setPoints(Array.from({ length: 90 }, (_, i) => point(89 - i, 80 + Math.sin(i) * 0.5)));

      expect(all('polyline.line')).toHaveLength(1);
      expect(all('circle.dot')).toHaveLength(1);
      expect(all('circle.dot.last')).toHaveLength(1);
    });

    it('keeps every point on the line', async () => {
      await setPoints(Array.from({ length: 90 }, (_, i) => point(89 - i, 80)));

      expect(linePoints()).toHaveLength(90);
    });
  });

  it('clamps a weigh-in older than the window to the left edge', async () => {
    host.from.set(day(10));
    await setPoints([point(30, 85), point(0, 80)]);

    const xs = linePoints().map((p) => p.x);

    // Pinned to the plot's left padding rather than drawn off the canvas.
    expect(xs[0]).toBe(28);
    expect(xs[0]).toBeLessThan(xs[1]);
  });

  it('survives a window that starts and ends on the same day', async () => {
    host.from.set(day(0));
    host.to.set(day(0));
    await setPoints([point(0, 80)]);

    expect(el('svg.plot')).toBeTruthy();
    expect(all('circle.dot.last')).toHaveLength(1);
  });
});
