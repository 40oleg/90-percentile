import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CalorieLogComponent,
  OVERSCAN,
  ROW_HEIGHT,
  VIEWPORT_HEIGHT,
  formatEntryDate,
} from './calorie-log.component';
import { CalorieEntry } from '../../models/calorie-entry.model';

@Component({
  standalone: true,
  imports: [CalorieLogComponent],
  template: `<app-calorie-log [entries]="entries()" (removed)="removed.push($event)" />`,
})
class HostComponent {
  readonly entries = signal<CalorieEntry[]>([]);
  removed: string[] = [];
}

/** `count` entries, newest first, one per day going back from today. */
function makeEntries(count: number): CalorieEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const at = new Date();
    at.setHours(12, 0, 0, 0);
    at.setDate(at.getDate() - i);
    return { id: `e${i}`, kcal: (i + 1) * 100, at: at.toISOString() };
  });
}

describe('CalorieLogComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function viewport(): HTMLElement {
    return fixture.nativeElement.querySelector('.log-viewport');
  }

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.log-row'));
  }

  function renderedIds(): string[] {
    return rows().map((r) => r.querySelector('.log-kcal')!.textContent!.trim());
  }

  /** jsdom never lays out, so scrollTop is stubbed before the real scroll event. */
  async function scrollTo(px: number): Promise<void> {
    const el = viewport();
    Object.defineProperty(el, 'scrollTop', { value: px, configurable: true });
    el.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
  }

  async function setEntries(entries: CalorieEntry[]): Promise<void> {
    host.entries.set(entries);
    await fixture.whenStable();
  }

  describe('empty state', () => {
    it('shows a hint instead of a viewport when there is nothing logged', () => {
      expect(fixture.nativeElement.querySelector('.log-empty')).toBeTruthy();
      expect(viewport()).toBeNull();
    });

    it('replaces the hint with the list once an entry arrives', async () => {
      await setEntries(makeEntries(1));

      expect(fixture.nativeElement.querySelector('.log-empty')).toBeNull();
      expect(rows()).toHaveLength(1);
    });
  });

  describe('rendering', () => {
    beforeEach(async () => {
      await setEntries(makeEntries(3));
    });

    it('renders a row per entry for a short list', () => {
      expect(rows()).toHaveLength(3);
    });

    it('shows the kcal value of each entry', () => {
      expect(renderedIds()).toEqual(['100', '200', '300']);
    });

    it('shows the date each entry was logged', () => {
      const date = fixture.nativeElement.querySelector('.log-date').textContent.trim();

      expect(date).toMatch(/^\d{2}\.\d{2} · \d{2}:\d{2}$/);
    });

    it('gives every row a delete button with an accessible label', () => {
      const remove: HTMLButtonElement = rows()[0].querySelector('.log-remove')!;

      expect(remove.getAttribute('aria-label')).toBe('Удалить запись 100 ккал');
    });

    it('emits the entry id when a delete button is clicked', async () => {
      rows()[1].querySelector<HTMLButtonElement>('.log-remove')!.click();
      await fixture.whenStable();

      expect(host.removed).toEqual(['e1']);
    });

    it('exposes the log as a list to assistive tech', () => {
      expect(viewport().getAttribute('role')).toBe('list');
      expect(rows()[0].getAttribute('role')).toBe('listitem');
    });
  });

  describe('virtual scrolling', () => {
    const TOTAL = 1000;

    beforeEach(async () => {
      await setEntries(makeEntries(TOTAL));
    });

    it('keeps the viewport a fixed, compact height', () => {
      expect(viewport().style.height).toBe(`${VIEWPORT_HEIGHT}px`);
    });

    it('renders only a small window of rows for a huge log', () => {
      expect(rows().length).toBeLessThan(20);
      expect(rows().length).toBeGreaterThan(0);
    });

    it('sizes the spacer to the full list so the scrollbar is honest', () => {
      const spacer: HTMLElement = fixture.nativeElement.querySelector('.log-spacer');

      expect(spacer.style.height).toBe(`${TOTAL * ROW_HEIGHT}px`);
    });

    it('starts at the newest entries with no offset', () => {
      const window: HTMLElement = fixture.nativeElement.querySelector('.log-window');

      expect(renderedIds()[0]).toBe('100');
      expect(window.style.transform).toBe('translateY(0px)');
    });

    it('swaps in later entries as the viewport scrolls', async () => {
      await scrollTo(ROW_HEIGHT * 100);

      expect(renderedIds()).not.toContain('100');
      expect(renderedIds()[0]).toBe(`${(100 - OVERSCAN + 1) * 100}`);
    });

    it('offsets the rendered window by the rows it skipped', async () => {
      await scrollTo(ROW_HEIGHT * 100);
      const window: HTMLElement = fixture.nativeElement.querySelector('.log-window');

      expect(window.style.transform).toBe(`translateY(${(100 - OVERSCAN) * ROW_HEIGHT}px)`);
    });

    it('keeps the rendered window small no matter how far it is scrolled', async () => {
      await scrollTo(ROW_HEIGHT * 500);

      expect(rows().length).toBeLessThan(20);
    });

    it('renders the last entries at the bottom of the log', async () => {
      await scrollTo(TOTAL * ROW_HEIGHT);

      expect(renderedIds()).toContain(`${TOTAL * 100}`);
      expect(rows().length).toBeLessThan(20);
    });

    it('never renders past the end of the list', async () => {
      await scrollTo(TOTAL * ROW_HEIGHT * 10);

      expect(rows().length).toBeLessThanOrEqual(VIEWPORT_HEIGHT / ROW_HEIGHT + OVERSCAN * 2 + 1);
      expect(renderedIds().at(-1)).toBe(`${TOTAL * 100}`);
    });

    it('re-clamps the window when the list shrinks under the scroll position', async () => {
      await scrollTo(ROW_HEIGHT * 900);
      await setEntries(makeEntries(3));

      expect(renderedIds()).toEqual(['100', '200', '300']);
    });

    it('deleting from a scrolled window emits the right entry', async () => {
      await scrollTo(ROW_HEIGHT * 100);
      const firstVisible = renderedIds()[0];
      rows()[0].querySelector<HTMLButtonElement>('.log-remove')!.click();
      await fixture.whenStable();

      expect(host.removed).toEqual([`e${Number(firstVisible) / 100 - 1}`]);
    });
  });

  describe('formatEntryDate()', () => {
    it('formats a timestamp as DD.MM · HH:MM', () => {
      expect(formatEntryDate(new Date(2026, 7, 1, 14, 5).toISOString())).toBe('01.08 · 14:05');
    });

    it('zero-pads single-digit parts', () => {
      expect(formatEntryDate(new Date(2026, 0, 9, 3, 7).toISOString())).toBe('09.01 · 03:07');
    });

    it('falls back to a dash for an unparseable date', () => {
      expect(formatEntryDate('not-a-date')).toBe('—');
    });
  });
});
