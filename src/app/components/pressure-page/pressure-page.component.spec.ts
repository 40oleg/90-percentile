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

  describe('auto-advance', () => {
    /** Types `text` into the field one character at a time, as a thumb would. */
    async function typeInto(index: number, text: string): Promise<void> {
      const field = inputs()[index];
      field.focus();
      for (const char of text) {
        field.value += char;
        field.dispatchEvent(new Event('input'));
        await fixture.whenStable();
      }
    }

    /** Types into whichever field holds the caret — the thumb never aims. */
    async function typeBlind(text: string): Promise<void> {
      for (const char of text) {
        const field = document.activeElement as HTMLInputElement;
        field.value += char;
        field.dispatchEvent(new Event('input'));
        await fixture.whenStable();
      }
    }

    function focused(): Element | null {
      return document.activeElement;
    }

    it('hands the caret to the lower field after three digits up top', async () => {
      await typeInto(0, '120');

      expect(focused()).toBe(inputs()[1]);
    });

    it('stays in the upper field while it is unfinished', async () => {
      await typeInto(0, '12');

      expect(focused()).toBe(inputs()[0]);
    });

    it('hands the caret to the pulse after two digits in the lower field', async () => {
      await typeInto(1, '80');

      expect(focused()).toBe(inputs()[2]);
    });

    it('stays in the lower field after a single digit', async () => {
      await typeInto(1, '8');

      expect(focused()).toBe(inputs()[1]);
    });

    it('lets go of the caret after two digits of pulse, dropping the keyboard', async () => {
      await typeInto(2, '65');

      expect(focused()).not.toBe(inputs()[2]);
    });

    it('walks the whole reading without a single tap on a field', async () => {
      inputs()[0].focus();
      await typeBlind('1208065');

      expect(inputs().map((i) => i.value)).toEqual(['120', '80', '65']);
      expect(focused()).not.toBe(inputs()[2]);
    });

    it('selects what is already there, so a correction overwrites it', async () => {
      await type(['', '80', '']);
      await typeInto(0, '120');

      const diastolic = inputs()[1];
      expect(focused()).toBe(diastolic);
      expect(diastolic.selectionStart).toBe(0);
      expect(diastolic.selectionEnd).toBe(2);
    });

    it('keeps only digits, so stray characters never count towards the jump', async () => {
      await typeInto(0, '1a2');

      expect(inputs()[0].value).toBe('12');
      expect(focused()).toBe(inputs()[0]);
    });

    it('stops at three digits', async () => {
      await typeInto(2, '1234');

      expect(inputs()[2].value).toBe('123');
    });

    // The jump is by digit count, so a lower value of 100+ spills its last digit
    // into the pulse. Two digits is the right cut for 60–99, which is the norm.
    it('sends the third digit of a 100+ lower value on to the pulse', async () => {
      inputs()[1].focus();
      await typeBlind('105');

      expect(inputs()[1].value).toBe('10');
      expect(inputs()[2].value).toBe('5');
    });

    it('still records the reading typed straight through', async () => {
      inputs()[0].focus();
      await typeBlind('1208065');
      el<HTMLFormElement>('.entry-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await fixture.whenStable();

      expect(pressure.entries()[0]).toMatchObject({ systolic: 120, diastolic: 80, pulse: 65 });
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
