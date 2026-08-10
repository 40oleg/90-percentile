import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PressurePageComponent } from './pressure-page.component';
import { PressureService } from '../../services/pressure.service';
import { SoundService } from '../../services/sound.service';

describe('PressurePageComponent', () => {
  let fixture: ComponentFixture<PressurePageComponent>;
  let pressure: PressureService;
  let sound: SoundService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [PressurePageComponent] }).compileComponents();
    pressure = TestBed.inject(PressureService);
    sound = TestBed.inject(SoundService);
    fixture = TestBed.createComponent(PressurePageComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function el<T extends HTMLElement>(selector: string): T {
    return root().querySelector<T>(selector)!;
  }

  function inputs(): HTMLInputElement[] {
    return Array.from(root().querySelectorAll<HTMLInputElement>('.field-input'));
  }

  function averageValue(): string {
    return el('.average-value').textContent!.trim();
  }

  function statValues(): string[] {
    return Array.from(root().querySelectorAll<HTMLElement>('.stat-value')).map((s) =>
      s.textContent!.replace(/\s+/g, ' ').trim(),
    );
  }

  function errorText(): string | null {
    return root().querySelector('.entry-error')?.textContent?.trim() ?? null;
  }

  async function type(values: [string, string, string]): Promise<void> {
    inputs().forEach((input, i) => {
      input.value = values[i];
      input.dispatchEvent(new Event('input'));
    });
    await fixture.whenStable();
  }

  async function submit(values: [string, string, string]): Promise<void> {
    await type(values);
    el<HTMLFormElement>('.entry-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
  }

  /** `offset` days from today at a given local hour. */
  function dayAt(offset: number, hour: number): Date {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }

  async function seed(...readings: [number, number, number, Date][]): Promise<void> {
    for (const [sys, dia, pulse, at] of readings) pressure.add(sys, dia, pulse, at);
    await fixture.whenStable();
  }

  describe('layout', () => {
    it('offers exactly three fields and one add button', () => {
      expect(inputs()).toHaveLength(3);
      expect(el('.entry-submit').textContent!.trim()).toBe('ДОБАВИТЬ');
    });

    it('labels the fields', () => {
      const labels = Array.from(root().querySelectorAll('.field-label')).map((l) =>
        l.textContent!.trim(),
      );

      expect(labels).toEqual(['ВЕРХНЕЕ', 'НИЖНЕЕ', 'ПУЛЬС']);
    });

    it('draws a chart for the morning and one for the evening', () => {
      const titles = Array.from(root().querySelectorAll('.chart-title')).map((t) =>
        t.textContent!.trim(),
      );

      expect(titles).toEqual(['УТРО', 'ВЕЧЕР']);
    });

    it('explains where the reading will land', () => {
      const hint = el('.slot-hint').textContent!;

      expect(hint).toContain('ДО 12:00 УТРО');
      expect(hint).toContain(new Date().getHours() < 12 ? 'КАК УТРО' : 'КАК ВЕЧЕР');
    });
  });

  describe('empty state', () => {
    it('shows dashes instead of an average', () => {
      expect(averageValue()).toBe('—/—');
      expect(root().textContent).toContain('ЗАМЕРОВ ПОКА НЕТ');
    });

    it('shows dashes for both slots and a zero count', () => {
      expect(statValues()).toEqual(['—', '—', '0']);
    });

    it('shows no category badge', () => {
      expect(root().querySelector('.category')).toBeNull();
    });
  });

  describe('adding a reading', () => {
    it('records what was typed', async () => {
      await submit(['120', '80', '65']);

      expect(pressure.entries()).toHaveLength(1);
      expect(pressure.entries()[0]).toMatchObject({ systolic: 120, diastolic: 80, pulse: 65 });
    });

    it('clears the fields afterwards', async () => {
      await submit(['120', '80', '65']);

      expect(inputs().map((i) => i.value)).toEqual(['', '', '']);
    });

    it('updates the average on screen', async () => {
      await submit(['120', '80', '65']);

      expect(averageValue()).toBe('120/80');
      expect(root().textContent).toContain('ПУЛЬС 65');
    });

    it('shows the band of the average', async () => {
      await submit(['150', '95', '70']);

      expect(el('.category').textContent!.trim()).toBe('ГИПЕРТОНИЯ 2');
      expect(el('.average-panel').classList.contains('high2')).toBe(true);
    });

    it('plays the add sound for a healthy reading', async () => {
      const add = vi.spyOn(sound, 'playAdd');
      await submit(['115', '75', '60']);

      expect(add).toHaveBeenCalled();
    });

    it('warns out loud about a high reading', async () => {
      const warn = vi.spyOn(sound, 'playWarn');
      await submit(['170', '105', '90']);

      expect(warn).toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('refuses an empty form', async () => {
      await submit(['', '', '']);

      expect(errorText()).toBe('Заполни все три поля целыми числами.');
      expect(pressure.entries()).toEqual([]);
    });

    it('refuses a partly filled form', async () => {
      await submit(['120', '', '65']);

      expect(errorText()).toContain('все три поля');
    });

    it('refuses non-numeric input', async () => {
      await submit(['сто', '80', '65']);

      expect(errorText()).toContain('все три поля');
    });

    it('refuses a value above the limit and names the field', async () => {
      await submit(['400', '80', '65']);

      expect(errorText()).toContain('Верхнее');
      expect(pressure.entries()).toEqual([]);
    });

    it('refuses a lower value below the limit', async () => {
      await submit(['120', '10', '65']);

      expect(errorText()).toContain('Нижнее');
    });

    it('refuses an impossible pulse', async () => {
      await submit(['120', '80', '900']);

      expect(errorText()).toContain('Пульс');
    });

    it('refuses a lower value that beats the upper one', async () => {
      await submit(['80', '120', '65']);

      expect(errorText()).toBe('Верхнее должно быть больше нижнего.');
    });

    it('clears the error as soon as the user types again', async () => {
      await submit(['', '', '']);
      expect(errorText()).not.toBeNull();

      await type(['120', '80', '65']);

      expect(errorText()).toBeNull();
    });
  });

  describe('statistics', () => {
    it('splits the averages by slot', async () => {
      await seed(
        [118, 76, 60, dayAt(-1, 9)],
        [132, 88, 74, dayAt(-1, 20)],
        [122, 78, 62, dayAt(0, 8)],
      );

      const [morning, evening, total] = statValues();
      expect(morning).toBe('120/77 · 61');
      expect(evening).toBe('132/88 · 74');
      expect(total).toBe('3');
    });

    it('counts every stored reading, however old', async () => {
      await seed([120, 80, 65, dayAt(-200, 9)], [120, 80, 65, dayAt(0, 9)]);

      expect(statValues()[2]).toBe('2');
    });

    it('averages only the charted window', async () => {
      await seed([200, 120, 100, dayAt(-200, 9)], [120, 80, 65, dayAt(0, 9)]);

      expect(averageValue()).toBe('120/80');
    });

    it('names the window in the caption', () => {
      expect(el('.average-caption').textContent!.trim()).toBe('СРЕДНЕЕ ЗА 14 ДНЕЙ');
    });
  });

  describe('charts', () => {
    it('plots a morning reading on the morning chart only', async () => {
      await seed([118, 76, 60, dayAt(-1, 9)]);

      const [morningChart, eveningChart] = Array.from(
        root().querySelectorAll('app-pressure-chart'),
      );
      expect(morningChart.querySelector('svg.plot')).toBeTruthy();
      expect(eveningChart.querySelector('.chart-empty')).toBeTruthy();
    });

    it('plots the reading just added', async () => {
      await submit(['120', '80', '65']);

      const slot = new Date().getHours() < 12 ? 0 : 1;
      const charts = Array.from(root().querySelectorAll('app-pressure-chart'));

      expect(charts[slot].querySelectorAll('circle').length).toBe(3);
    });
  });
});
