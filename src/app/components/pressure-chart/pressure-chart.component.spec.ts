import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PressureChartComponent } from './pressure-chart.component';
import { PressureDayPoint } from '../../models/pressure-entry.model';

const DAY_MS = 86_400_000;

/** A charted day; passing no values leaves the day empty. */
function point(
  index: number,
  values?: { systolic: number; diastolic: number; pulse: number },
): PressureDayPoint {
  return {
    dayStart: index * DAY_MS,
    label: `${String(index + 1).padStart(2, '0')}.01`,
    systolic: values?.systolic ?? null,
    diastolic: values?.diastolic ?? null,
    pulse: values?.pulse ?? null,
    count: values ? 1 : 0,
  };
}

function reading(systolic: number, diastolic: number, pulse: number) {
  return { systolic, diastolic, pulse };
}

@Component({
  standalone: true,
  imports: [PressureChartComponent],
  template: `<app-pressure-chart [title]="title()" [points]="points()" />`,
})
class HostComponent {
  readonly title = signal('УТРО');
  readonly points = signal<PressureDayPoint[]>([]);
}

describe('PressureChartComponent', () => {
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

  function polylines(series: string): string[] {
    return all(`polyline.${series}`).map((line) => line.getAttribute('points')!);
  }

  async function setPoints(points: PressureDayPoint[]): Promise<void> {
    host.points.set(points);
    await fixture.whenStable();
  }

  describe('empty state', () => {
    it('shows a placeholder when nothing was measured', () => {
      expect(el('.chart-empty')!.textContent!.trim()).toBe('НЕТ ЗАМЕРОВ');
      expect(el('svg.plot')).toBeNull();
    });

    it('still shows the placeholder for a window of empty days', async () => {
      await setPoints([point(0), point(1), point(2)]);

      expect(el('.chart-empty')).toBeTruthy();
    });

    it('renders the title and the legend regardless', () => {
      expect(el('.chart-title')!.textContent!.trim()).toBe('УТРО');
      expect(all('.legend-item').map((i) => i.textContent!.trim())).toEqual([
        'ВЕРХ',
        'НИЗ',
        'ПУЛЬС',
      ]);
    });
  });

  describe('plotting', () => {
    beforeEach(async () => {
      await setPoints([
        point(0, reading(120, 80, 60)),
        point(1, reading(130, 85, 70)),
        point(2, reading(125, 82, 65)),
      ]);
    });

    it('draws the plot once there is data', () => {
      expect(el('svg.plot')).toBeTruthy();
      expect(el('.chart-empty')).toBeNull();
    });

    it('draws one line per series', () => {
      expect(polylines('systolic')).toHaveLength(1);
      expect(polylines('diastolic')).toHaveLength(1);
      expect(polylines('pulse')).toHaveLength(1);
    });

    it('puts one dot on every measured day of every series', () => {
      expect(all('circle.systolic')).toHaveLength(3);
      expect(all('circle.diastolic')).toHaveLength(3);
      expect(all('circle.pulse')).toHaveLength(3);
    });

    it('walks the days left to right', () => {
      const xs = polylines('systolic')[0]
        .split(' ')
        .map((pair) => Number(pair.split(',')[0]));

      expect(xs).toHaveLength(3);
      expect(xs[0]).toBeLessThan(xs[1]);
      expect(xs[1]).toBeLessThan(xs[2]);
    });

    it('puts higher values higher up the plot', () => {
      const ys = polylines('systolic')[0]
        .split(' ')
        .map((pair) => Number(pair.split(',')[1]));

      // 120 → 130 → 125, and y grows downwards.
      expect(ys[1]).toBeLessThan(ys[0]);
      expect(ys[2]).toBeGreaterThan(ys[1]);
    });

    it('keeps the upper line above the lower one', () => {
      const topY = Number(polylines('systolic')[0].split(' ')[0].split(',')[1]);
      const bottomY = Number(polylines('diastolic')[0].split(' ')[0].split(',')[1]);

      expect(topY).toBeLessThan(bottomY);
    });

    it('counts the measured days in the header', () => {
      expect(el('.chart-days')!.textContent!.trim()).toBe('3/3 ДН.');
    });

    it('names the day and the value on every dot', () => {
      const titles = all('circle.systolic title').map((t) => t.textContent!.trim());

      expect(titles[0]).toBe('01.01 · ВЕРХ 120');
    });

    it('describes the chart for screen readers', () => {
      const label = el('svg.plot')!.getAttribute('aria-label')!;

      expect(label).toContain('УТРО');
      expect(label).toContain('3 дн.');
      expect(label).toContain('125');
    });
  });

  describe('gaps', () => {
    it('breaks the line on a day without a reading', async () => {
      await setPoints([
        point(0, reading(120, 80, 60)),
        point(1, reading(122, 81, 61)),
        point(2),
        point(3, reading(126, 84, 64)),
        point(4, reading(128, 85, 65)),
      ]);

      expect(polylines('systolic')).toHaveLength(2);
      expect(all('circle.systolic')).toHaveLength(4);
      expect(el('.chart-days')!.textContent!.trim()).toBe('4/5 ДН.');
    });

    it('drops a lone measured day to a dot with no line', async () => {
      await setPoints([point(0), point(1, reading(120, 80, 60)), point(2)]);

      expect(polylines('systolic')).toHaveLength(0);
      expect(all('circle.systolic')).toHaveLength(1);
    });
  });

  describe('axes', () => {
    it('brackets the data with rounded labels', async () => {
      await setPoints([point(0, reading(120, 80, 60)), point(1, reading(130, 85, 70))]);

      const labels = all('.axis-text')
        .map((t) => Number(t.textContent!.trim()))
        .filter((n) => !Number.isNaN(n));
      const values = labels.filter((n) => n >= 40);

      expect(Math.max(...values)).toBeGreaterThanOrEqual(130);
      expect(Math.min(...values)).toBeLessThanOrEqual(60);
    });

    it('never drops below zero on the axis', async () => {
      await setPoints([point(0, reading(95, 60, 40))]);

      const values = all('.axis-text').map((t) => Number(t.textContent!.trim()));

      expect(values.filter((n) => !Number.isNaN(n)).every((n) => n >= 0)).toBe(true);
    });

    it('thins out the day labels instead of stamping all fourteen', async () => {
      await setPoints(Array.from({ length: 14 }, (_, i) => point(i, reading(120 + i, 80, 60))));

      const xLabels = all('.axis-text.x');

      expect(xLabels.length).toBeGreaterThan(1);
      expect(xLabels.length).toBeLessThanOrEqual(5);
    });

    it('always stamps the newest day', async () => {
      await setPoints(Array.from({ length: 14 }, (_, i) => point(i, reading(120 + i, 80, 60))));

      const xLabels = all('.axis-text.x').map((t) => t.textContent!.trim());

      expect(xLabels.at(-1)).toBe('14.01');
    });
  });

  it('follows the title input', async () => {
    host.title.set('ВЕЧЕР');
    await fixture.whenStable();

    expect(el('.chart-title')!.textContent!.trim()).toBe('ВЕЧЕР');
  });
});
