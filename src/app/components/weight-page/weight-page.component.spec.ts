import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeightPageComponent } from './weight-page.component';
import { WeightService } from '../../services/weight.service';
import { SoundService } from '../../services/sound.service';

describe('WeightPageComponent', () => {
  let fixture: ComponentFixture<WeightPageComponent>;
  let weight: WeightService;
  let sound: SoundService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [WeightPageComponent] }).compileComponents();
    weight = TestBed.inject(WeightService);
    sound = TestBed.inject(SoundService);
    fixture = TestBed.createComponent(WeightPageComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function el<T extends HTMLElement>(selector: string): T {
    return root().querySelector<T>(selector)!;
  }

  function input(): HTMLInputElement {
    return el('.entry-input');
  }

  function currentValue(): string {
    return el('.current-value').textContent!.trim();
  }

  function statValues(): string[] {
    return Array.from(root().querySelectorAll<HTMLElement>('.stat-value')).map((s) =>
      s.textContent!.trim(),
    );
  }

  function errorText(): string | null {
    return root().querySelector('.entry-error')?.textContent?.trim() ?? null;
  }

  function rangeButton(label: string): HTMLButtonElement {
    return Array.from(root().querySelectorAll<HTMLButtonElement>('.range-btn')).find((b) =>
      b.textContent?.includes(label),
    )!;
  }

  async function type(value: string): Promise<void> {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit(value: string): Promise<void> {
    await type(value);
    el<HTMLFormElement>('.entry-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
  }

  /** Local noon `offset` days from today. */
  function dayAt(offset: number): Date {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }

  async function seed(...weighIns: [number, Date][]): Promise<void> {
    for (const [kg, at] of weighIns) weight.add(kg, at);
    await fixture.whenStable();
  }

  describe('layout', () => {
    it('offers one field and one add button', () => {
      expect(root().querySelectorAll('.entry-input')).toHaveLength(1);
      expect(el('.entry-submit').textContent!.trim()).toBe('ДОБАВИТЬ');
    });

    it('offers the three ranges', () => {
      const labels = Array.from(root().querySelectorAll('.range-btn')).map((b) =>
        b.textContent!.trim(),
      );

      expect(labels).toEqual(['МЕСЯЦ', '3 МЕС.', 'ПОЛГОДА']);
    });

    it('draws one chart', () => {
      expect(root().querySelectorAll('app-weight-chart')).toHaveLength(1);
    });
  });

  describe('empty state', () => {
    it('shows a dash instead of a weight', () => {
      expect(currentValue()).toBe('—');
      expect(root().textContent).toContain('ЗАМЕРОВ ПОКА НЕТ');
    });

    it('shows dashes for the statistics', () => {
      expect(statValues()).toEqual(['—', '—', '—']);
    });

    it('shows the empty chart', () => {
      expect(root().querySelector('.chart-empty')).toBeTruthy();
    });
  });

  describe('adding a weigh-in', () => {
    it('records what was typed', async () => {
      await submit('74.5');

      expect(weight.entries()).toHaveLength(1);
      expect(weight.entries()[0].kg).toBe(74.5);
    });

    it('accepts a comma as the decimal separator', async () => {
      await submit('74,5');

      expect(weight.entries()[0].kg).toBe(74.5);
    });

    it('accepts a whole number', async () => {
      await submit('75');

      expect(currentValue()).toBe('75');
    });

    it('clears the field afterwards', async () => {
      await submit('74.5');

      expect(input().value).toBe('');
    });

    it('shows the new weight as the current one', async () => {
      await submit('74.5');

      expect(currentValue()).toBe('74.5');
    });

    it('plays the add sound', async () => {
      const add = vi.spyOn(sound, 'playAdd');
      await submit('74.5');

      expect(add).toHaveBeenCalled();
    });

    it('plots the weigh-in', async () => {
      await submit('74.5');

      expect(root().querySelector('svg.plot')).toBeTruthy();
      expect(root().querySelectorAll('circle.dot')).toHaveLength(2);
    });
  });

  describe('validation', () => {
    it('refuses an empty field', async () => {
      await submit('');

      expect(errorText()).toBe('Введи вес числом, например 74.5.');
      expect(weight.entries()).toEqual([]);
    });

    it('refuses text', async () => {
      await submit('много');

      expect(errorText()).toContain('числом');
    });

    it('refuses a weight below the limit', async () => {
      await submit('5');

      expect(errorText()).toBe('Вес: от 20 до 500 кг.');
      expect(weight.entries()).toEqual([]);
    });

    it('refuses a weight above the limit', async () => {
      await submit('900');

      expect(errorText()).toContain('от 20 до 500');
    });

    it('clears the error as soon as the user types again', async () => {
      await submit('');
      expect(errorText()).not.toBeNull();

      await type('74.5');

      expect(errorText()).toBeNull();
    });
  });

  describe('statistics', () => {
    it('shows the change, the lightest and the heaviest day', async () => {
      await seed([80, dayAt(-10)], [77.5, dayAt(-5)], [78, dayAt(0)]);

      expect(statValues()).toEqual(['−2', '77.5', '80']);
    });

    it('marks a gain in red and a loss in green', async () => {
      await seed([75, dayAt(-5)], [77, dayAt(0)]);
      expect(el('.stat-value').classList.contains('up')).toBe(true);

      await seed([73, dayAt(1)]);
      expect(el('.stat-value').classList.contains('down')).toBe(true);
    });

    it('has no change to show from a single weigh-in', async () => {
      await seed([75, dayAt(0)]);

      expect(statValues()[0]).toBe('—');
      expect(el('.stat-value').classList.contains('flat')).toBe(true);
    });
  });

  describe('range picker', () => {
    it('starts on the month', () => {
      expect(rangeButton('МЕСЯЦ').classList.contains('active')).toBe(true);
      expect(rangeButton('ПОЛГОДА').classList.contains('active')).toBe(false);
    });

    it('switches the charted stretch', async () => {
      rangeButton('ПОЛГОДА').click();
      await fixture.whenStable();

      expect(weight.rangeId()).toBe('half');
      expect(rangeButton('ПОЛГОДА').classList.contains('active')).toBe(true);
      expect(rangeButton('МЕСЯЦ').classList.contains('active')).toBe(false);
    });

    it('brings older weigh-ins onto the chart', async () => {
      await seed([90, dayAt(-60)], [80, dayAt(0)]);
      expect(statValues()).toEqual(['—', '80', '80']);

      rangeButton('3 МЕС.').click();
      await fixture.whenStable();

      expect(statValues()).toEqual(['−10', '80', '90']);
    });

    it('plays a click when the range changes', async () => {
      const click = vi.spyOn(sound, 'playClick');
      rangeButton('3 МЕС.').click();
      await fixture.whenStable();

      expect(click).toHaveBeenCalled();
    });

    it('stays quiet when the active range is tapped again', async () => {
      const click = vi.spyOn(sound, 'playClick');
      rangeButton('МЕСЯЦ').click();
      await fixture.whenStable();

      expect(click).not.toHaveBeenCalled();
    });

    it('exposes the active range to assistive tech', () => {
      expect(rangeButton('МЕСЯЦ').getAttribute('aria-pressed')).toBe('true');
      expect(rangeButton('ПОЛГОДА').getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('keeps the current weight even when it falls outside the range', async () => {
    await seed([95, dayAt(-100)]);

    expect(currentValue()).toBe('95');
    expect(root().querySelector('.chart-empty')).toBeTruthy();
  });
});
