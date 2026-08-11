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

    const doneTab = Array.from(fixture.nativeElement.querySelectorAll('.filter-btn')).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'ГОТОВО',
    ) as HTMLButtonElement;
    doneTab.click();
    await fixture.whenStable();

    expect(cards().length).toBe(1);
  });

  it('filters to only incomplete challenges', async () => {
    const firstToggle: HTMLButtonElement = cards()[0].querySelector('.toggle-area')!;
    firstToggle.click();
    await fixture.whenStable();

    const inProgressTab = Array.from(fixture.nativeElement.querySelectorAll('.filter-btn')).find(
      (b) => (b as HTMLElement).textContent?.trim() === 'В ПРОЦЕССЕ',
    ) as HTMLButtonElement;
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

  describe('section menu', () => {
    function navButton(label: string): HTMLButtonElement {
      const root = fixture.nativeElement as HTMLElement;
      return Array.from(root.querySelectorAll<HTMLButtonElement>('.nav-btn')).find((b) =>
        b.textContent?.includes(label),
      )!;
    }

    async function openCalories(): Promise<void> {
      navButton('ККАЛ').click();
      await fixture.whenStable();
    }

    async function openQuiz(): Promise<void> {
      navButton('ТЕСТ').click();
      await fixture.whenStable();
    }

    async function openPressure(): Promise<void> {
      navButton('ДАВЛЕНИЕ').click();
      await fixture.whenStable();
    }

    async function openWeight(): Promise<void> {
      navButton('ВЕС').click();
      await fixture.whenStable();
    }

    it('opens on the challenges section by default', () => {
      expect(fixture.nativeElement.querySelector('app-calorie-page')).toBeNull();
      expect(cards().length).toBe(CHALLENGES.length);
    });

    it('switches to the calorie section from the menu', async () => {
      await openCalories();

      expect(fixture.nativeElement.querySelector('app-calorie-page')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.average-value')).toBeTruthy();
    });

    it('hides the challenge list and its filters while on the calorie section', async () => {
      await openCalories();

      expect(cards().length).toBe(0);
      expect(fixture.nativeElement.querySelector('.filter-bar')).toBeNull();
      expect(fixture.nativeElement.querySelector('.progress-label')).toBeNull();
    });

    it('keeps the header and the mute button on both sections', async () => {
      await openCalories();

      expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('PERCENTILE');
      expect(fixture.nativeElement.querySelector('.mute-btn')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.nav-menu')).toBeTruthy();
    });

    it('switches back to the challenges section', async () => {
      await openCalories();
      navButton('ЧЕЛЛЕНДЖИ').click();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('app-calorie-page')).toBeNull();
      expect(cards().length).toBe(CHALLENGES.length);
    });

    it('remembers the calorie section for the next launch', async () => {
      await openCalories();
      TestBed.tick();
      expect(localStorage.getItem('90percentile.view')).toBe('calories');

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
      const relaunched = TestBed.createComponent(App);
      relaunched.autoDetectChanges();
      await relaunched.whenStable();

      expect(relaunched.nativeElement.querySelector('app-calorie-page')).toBeTruthy();
    });

    it('keeps challenge progress intact across a section switch', async () => {
      cards()[0].querySelector<HTMLButtonElement>('.toggle-area')!.click();
      await fixture.whenStable();

      await openCalories();
      navButton('ЧЕЛЛЕНДЖИ').click();
      await fixture.whenStable();

      expect(progressLabel()).toContain(`1/${CHALLENGES.length}`);
    });

    it('switches to the quiz section from the menu', async () => {
      await openQuiz();

      expect(fixture.nativeElement.querySelector('app-quiz-page')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.start-btn')).toBeTruthy();
    });

    it('hides the other sections while on the quiz', async () => {
      await openQuiz();

      expect(cards().length).toBe(0);
      expect(fixture.nativeElement.querySelector('app-calorie-page')).toBeNull();
      expect(fixture.nativeElement.querySelector('.progress-label')).toBeNull();
    });

    it('keeps the header and the mute button on the quiz section', async () => {
      await openQuiz();

      expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('PERCENTILE');
      expect(fixture.nativeElement.querySelector('.mute-btn')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.nav-menu')).toBeTruthy();
    });

    it('remembers the quiz section for the next launch', async () => {
      await openQuiz();
      TestBed.tick();
      expect(localStorage.getItem('90percentile.view')).toBe('quiz');

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
      const relaunched = TestBed.createComponent(App);
      relaunched.autoDetectChanges();
      await relaunched.whenStable();

      expect(relaunched.nativeElement.querySelector('app-quiz-page')).toBeTruthy();
    });

    it('switches to the pressure section from the menu', async () => {
      await openPressure();

      expect(fixture.nativeElement.querySelector('app-pressure-page')).toBeTruthy();
      expect(fixture.nativeElement.querySelectorAll('.field-input')).toHaveLength(3);
      expect(fixture.nativeElement.querySelectorAll('app-pressure-chart')).toHaveLength(2);
    });

    it('hides the other sections while on the pressure diary', async () => {
      await openPressure();

      expect(cards().length).toBe(0);
      expect(fixture.nativeElement.querySelector('app-calorie-page')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-quiz-page')).toBeNull();
      expect(fixture.nativeElement.querySelector('.progress-label')).toBeNull();
    });

    it('remembers the pressure section for the next launch', async () => {
      await openPressure();
      TestBed.tick();
      expect(localStorage.getItem('90percentile.view')).toBe('pressure');

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
      const relaunched = TestBed.createComponent(App);
      relaunched.autoDetectChanges();
      await relaunched.whenStable();

      expect(relaunched.nativeElement.querySelector('app-pressure-page')).toBeTruthy();
    });

    it('keeps logged readings intact across a section switch', async () => {
      await openPressure();
      const root = fixture.nativeElement as HTMLElement;
      const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('.field-input'));
      ['120', '80', '65'].forEach((value, i) => {
        inputs[i].value = value;
        inputs[i].dispatchEvent(new Event('input'));
      });
      fixture.nativeElement
        .querySelector('.entry-form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();

      navButton('ЧЕЛЛЕНДЖИ').click();
      await fixture.whenStable();
      await openPressure();

      expect(fixture.nativeElement.querySelector('.average-value').textContent.trim()).toBe(
        '120/80',
      );
    });

    it('switches to the weight section from the menu', async () => {
      await openWeight();

      expect(fixture.nativeElement.querySelector('app-weight-page')).toBeTruthy();
      expect(fixture.nativeElement.querySelectorAll('app-weight-chart')).toHaveLength(1);
      expect(fixture.nativeElement.querySelectorAll('.range-btn')).toHaveLength(3);
    });

    it('hides the other sections while on the weight diary', async () => {
      await openWeight();

      expect(cards().length).toBe(0);
      expect(fixture.nativeElement.querySelector('app-calorie-page')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-pressure-page')).toBeNull();
    });

    it('remembers the weight section for the next launch', async () => {
      await openWeight();
      TestBed.tick();
      expect(localStorage.getItem('90percentile.view')).toBe('weight');

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
      const relaunched = TestBed.createComponent(App);
      relaunched.autoDetectChanges();
      await relaunched.whenStable();

      expect(relaunched.nativeElement.querySelector('app-weight-page')).toBeTruthy();
    });

    it('keeps a logged weigh-in across a section switch', async () => {
      await openWeight();
      const root = fixture.nativeElement as HTMLElement;
      const field = root.querySelector<HTMLInputElement>('.entry-input')!;
      field.value = '74.5';
      field.dispatchEvent(new Event('input'));
      root
        .querySelector('.entry-form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();

      navButton('ЧЕЛЛЕНДЖИ').click();
      await fixture.whenStable();
      await openWeight();

      expect(fixture.nativeElement.querySelector('.current-value').textContent.trim()).toBe('74.5');
    });

    it('keeps a running test alive across a section switch', async () => {
      await openQuiz();
      fixture.nativeElement.querySelector('.start-btn').click();
      await fixture.whenStable();
      const step = fixture.nativeElement.querySelector('.runner-step').textContent.trim();

      navButton('ЧЕЛЛЕНДЖИ').click();
      await fixture.whenStable();
      await openQuiz();

      expect(fixture.nativeElement.querySelector('.runner-step').textContent.trim()).toBe(step);
      expect(fixture.nativeElement.querySelectorAll('.option')).toHaveLength(4);
    });

    it('keeps challenge progress intact across a quiz switch', async () => {
      cards()[0].querySelector<HTMLButtonElement>('.toggle-area')!.click();
      await fixture.whenStable();

      await openQuiz();
      navButton('ЧЕЛЛЕНДЖИ').click();
      await fixture.whenStable();

      expect(progressLabel()).toContain(`1/${CHALLENGES.length}`);
    });

    it('keeps logged calories intact across a section switch', async () => {
      await openCalories();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('.entry-input');
      input.value = '1500';
      input.dispatchEvent(new Event('input'));
      fixture.nativeElement
        .querySelector('.entry-form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();

      navButton('ЧЕЛЛЕНДЖИ').click();
      await fixture.whenStable();
      await openCalories();

      expect(fixture.nativeElement.querySelector('.average-value').textContent.trim()).toBe('1500');
    });
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
