import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { CHALLENGES } from './data/challenges.data';

describe('App', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
    fixture = TestBed.createComponent(App);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function cards(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-challenge-card'));
  }

  function progressLabel(): string {
    return fixture.nativeElement.querySelector('.progress-label').textContent.trim();
  }

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('PERCENTILE');
  });

  it('renders a card for every challenge', () => {
    expect(cards().length).toBe(CHALLENGES.length);
  });

  it('starts with 0 completed and 0%', () => {
    expect(progressLabel()).toContain(`0/${CHALLENGES.length}`);
    expect(progressLabel()).toContain('0%');
  });

  it('updates progress when a card is toggled complete', async () => {
    const firstToggle: HTMLButtonElement = cards()[0].querySelector('.toggle-area')!;
    firstToggle.click();
    await fixture.whenStable();

    expect(progressLabel()).toContain(`1/${CHALLENGES.length}`);
  });

  it('filters to only completed challenges', async () => {
    const firstToggle: HTMLButtonElement = cards()[0].querySelector('.toggle-area')!;
    firstToggle.click();
    await fixture.whenStable();

    const doneTab = Array.from(
      fixture.nativeElement.querySelectorAll('.filter-btn'),
    ).find((b) => (b as HTMLElement).textContent?.trim() === 'ГОТОВО') as HTMLButtonElement;
    doneTab.click();
    await fixture.whenStable();

    expect(cards().length).toBe(1);
  });

  it('filters to only incomplete challenges', async () => {
    const firstToggle: HTMLButtonElement = cards()[0].querySelector('.toggle-area')!;
    firstToggle.click();
    await fixture.whenStable();

    const inProgressTab = Array.from(
      fixture.nativeElement.querySelectorAll('.filter-btn'),
    ).find((b) => (b as HTMLElement).textContent?.trim() === 'В ПРОЦЕССЕ') as HTMLButtonElement;
    inProgressTab.click();
    await fixture.whenStable();

    expect(cards().length).toBe(CHALLENGES.length - 1);
  });

  it('toggling a card back to incomplete reverts progress', async () => {
    const firstToggle: HTMLButtonElement = cards()[0].querySelector('.toggle-area')!;
    firstToggle.click();
    await fixture.whenStable();
    firstToggle.click();
    await fixture.whenStable();

    expect(progressLabel()).toContain(`0/${CHALLENGES.length}`);
  });

  it('toggles the mute button state and icon', async () => {
    const muteBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.mute-btn');
    expect(muteBtn.getAttribute('aria-pressed')).toBe('false');
    expect(muteBtn.textContent).toContain('🔊');

    muteBtn.click();
    await fixture.whenStable();

    expect(muteBtn.getAttribute('aria-pressed')).toBe('true');
    expect(muteBtn.textContent).toContain('🔇');
  });
});
