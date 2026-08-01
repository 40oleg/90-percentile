import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CaloriePageComponent } from './calorie-page.component';
import { CalorieService } from '../../services/calorie.service';
import { SoundService } from '../../services/sound.service';

describe('CaloriePageComponent', () => {
  let fixture: ComponentFixture<CaloriePageComponent>;
  let calories: CalorieService;
  let sound: SoundService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [CaloriePageComponent] }).compileComponents();
    calories = TestBed.inject(CalorieService);
    sound = TestBed.inject(SoundService);
    fixture = TestBed.createComponent(CaloriePageComponent);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function el<T extends HTMLElement>(selector: string): T {
    return root().querySelector(selector) as T;
  }

  function textsOf(selector: string): string[] {
    return Array.from(root().querySelectorAll<HTMLElement>(selector)).map((e) =>
      e.textContent!.trim(),
    );
  }

  function averageValue(): HTMLElement {
    return el('.average-value');
  }

  function input(): HTMLInputElement {
    return el('.entry-input');
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

  function dayAt(offset: number): Date {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  }

  describe('average display', () => {
    it('starts at 0', () => {
      expect(averageValue().textContent!.trim()).toBe('0');
    });

    it('shows the daily average after an entry is logged', async () => {
      await submit('1000');

      expect(averageValue().textContent!.trim()).toBe('1000');
    });

    it('shows the norm', () => {
      expect(el('.norm-label').textContent).toContain('2200');
    });

    it('is green and labelled "В НОРМЕ" while inside the norm', async () => {
      await submit('2000');

      expect(averageValue().classList.contains('over')).toBe(false);
      expect(el('.norm-state').classList.contains('ok')).toBe(true);
      expect(el('.norm-state').textContent).toContain('В НОРМЕ');
    });

    it('turns red and labelled "ПРЕВЫШЕНА" once the norm is exceeded', async () => {
      await submit('5000');

      expect(averageValue().classList.contains('over')).toBe(true);
      expect(el('.average-panel').classList.contains('over')).toBe(true);
      expect(el('.norm-state').classList.contains('over')).toBe(true);
      expect(el('.norm-state').textContent).toContain('ПРЕВЫШЕНА');
    });

    it('stays green at exactly the norm', async () => {
      await submit('2200');

      expect(averageValue().textContent!.trim()).toBe('2200');
      expect(averageValue().classList.contains('over')).toBe(false);
    });

    it('turns red one kcal over the norm', async () => {
      await submit('2201');

      expect(averageValue().classList.contains('over')).toBe(true);
    });

    it('goes back to green when an untracked day pulls the average down', async () => {
      calories.add(3000, dayAt(-1));
      await fixture.whenStable();

      expect(averageValue().textContent!.trim()).toBe('1500');
      expect(averageValue().classList.contains('over')).toBe(false);
    });

    it('announces the average to assistive tech', () => {
      expect(averageValue().getAttribute('role')).toBe('status');
      expect(averageValue().getAttribute('aria-label')).toContain('Среднее потребление 0');
    });

    it('fills the norm bar proportionally', async () => {
      await submit('1100');

      expect(el('.norm-fill').style.width).toBe('50%');
    });

    it('caps the norm bar at 100% when the norm is blown', async () => {
      await submit('9999');

      expect(el('.norm-fill').style.width).toBe('100%');
      expect(el('.norm-fill').classList.contains('over')).toBe(true);
    });
  });

  describe('logging an entry', () => {
    it('records the typed amount', async () => {
      await submit('750');

      expect(calories.entries()).toHaveLength(1);
      expect(calories.entries()[0].kcal).toBe(750);
    });

    it('clears the input after a successful entry', async () => {
      await submit('750');

      expect(input().value).toBe('');
    });

    it('appends the entry to the log', async () => {
      await submit('750');

      expect(el('.log-kcal').textContent!.trim()).toBe('750');
    });

    it('accumulates several entries in one day', async () => {
      await submit('1000');
      await submit('1500');

      expect(averageValue().textContent!.trim()).toBe('2500');
      expect(fixture.nativeElement.querySelectorAll('.log-row')).toHaveLength(2);
    });

    it('plays the pickup sound for an entry within the norm', async () => {
      const spy = vi.spyOn(sound, 'playAdd');
      await submit('500');

      expect(spy).toHaveBeenCalled();
    });

    it('plays the warning sound when the entry pushes the average over the norm', async () => {
      const warn = vi.spyOn(sound, 'playWarn');
      const add = vi.spyOn(sound, 'playAdd');
      await submit('5000');

      expect(warn).toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('rejects an empty input with a message', async () => {
      await submit('');

      expect(el('.entry-error').textContent).toContain('положительное число');
      expect(calories.entries()).toHaveLength(0);
    });

    it('rejects zero', async () => {
      await submit('0');

      expect(el('.entry-error')).toBeTruthy();
      expect(calories.entries()).toHaveLength(0);
    });

    it('rejects a negative amount', async () => {
      await submit('-500');

      expect(el('.entry-error')).toBeTruthy();
      expect(calories.entries()).toHaveLength(0);
    });

    it('rejects non-numeric text', async () => {
      await submit('батон');

      expect(el('.entry-error')).toBeTruthy();
      expect(calories.entries()).toHaveLength(0);
    });

    it('rejects an absurd amount with its own message', async () => {
      await submit('999999');

      expect(el('.entry-error').textContent).toContain('Максимум');
      expect(calories.entries()).toHaveLength(0);
    });

    it('keeps the typed value so it can be corrected', async () => {
      await submit('-500');

      expect(input().value).toBe('-500');
    });

    it('clears the error as soon as the user types again', async () => {
      await submit('-500');
      expect(el('.entry-error')).toBeTruthy();

      await type('500');

      expect(el('.entry-error')).toBeNull();
    });

    it('marks the error as an alert', async () => {
      await submit('0');

      expect(el('.entry-error').getAttribute('role')).toBe('alert');
    });
  });

  describe('quick add buttons', () => {
    function quick(label: string): HTMLButtonElement {
      return Array.from(root().querySelectorAll<HTMLButtonElement>('.quick-btn')).find(
        (b) => b.textContent?.trim() === label,
      )!;
    }

    it('offers one-tap amounts', () => {
      expect(fixture.nativeElement.querySelectorAll('.quick-btn')).toHaveLength(4);
      expect(quick('+1000')).toBeTruthy();
    });

    it('fills an empty input with the tapped amount', async () => {
      quick('+500').click();
      await fixture.whenStable();

      expect(input().value).toBe('500');
    });

    it('adds to the amount already typed', async () => {
      await type('250');
      quick('+1000').click();
      await fixture.whenStable();

      expect(input().value).toBe('1250');
    });

    it('does not log anything by itself', async () => {
      quick('+500').click();
      await fixture.whenStable();

      expect(calories.entries()).toHaveLength(0);
    });

    it('feeds straight into a submit', async () => {
      quick('+250').click();
      await fixture.whenStable();
      el<HTMLFormElement>('.entry-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await fixture.whenStable();

      expect(calories.entries()[0].kcal).toBe(250);
    });

    it('clears a pending error', async () => {
      await submit('-1');
      quick('+100').click();
      await fixture.whenStable();

      expect(el('.entry-error')).toBeNull();
    });
  });

  describe('stats', () => {
    it('shows today, days tracked and the running total', async () => {
      calories.add(1000, dayAt(-1));
      await submit('500');

      expect(textsOf('.stat-value')).toEqual(['500', '2', '1500']);
    });

    it('starts every stat at zero', () => {
      expect(textsOf('.stat-value')).toEqual(['0', '0', '0']);
    });
  });

  describe('removing an entry', () => {
    it('drops the entry and recomputes the average', async () => {
      await submit('1000');
      await submit('3000');
      expect(averageValue().textContent!.trim()).toBe('4000');

      el<HTMLButtonElement>('.log-remove').click();
      await fixture.whenStable();

      expect(calories.entries()).toHaveLength(1);
      expect(averageValue().textContent!.trim()).toBe('1000');
    });

    it('plays the undo sound', async () => {
      await submit('1000');
      const spy = vi.spyOn(sound, 'playUndo');

      el<HTMLButtonElement>('.log-remove').click();
      await fixture.whenStable();

      expect(spy).toHaveBeenCalled();
    });

    it('returns to the empty hint once the log is emptied', async () => {
      await submit('1000');
      el<HTMLButtonElement>('.log-remove').click();
      await fixture.whenStable();

      expect(el('.log-empty')).toBeTruthy();
      expect(averageValue().textContent!.trim()).toBe('0');
    });
  });

  describe('persistence', () => {
    it('renders entries restored from localStorage', async () => {
      calories.add(2000, dayAt(-3));
      TestBed.tick();

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [CaloriePageComponent] }).compileComponents();
      const reloaded = TestBed.createComponent(CaloriePageComponent);
      reloaded.autoDetectChanges();
      await reloaded.whenStable();

      expect(reloaded.nativeElement.querySelector('.average-value').textContent.trim()).toBe('500');
      expect(reloaded.nativeElement.querySelectorAll('.log-row')).toHaveLength(1);
    });
  });
});
