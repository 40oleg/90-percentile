import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHALLENGES } from '../../data/challenges.data';
import { Challenge } from '../../models/challenge.model';
import { VideoProofService } from '../../services/video-proof.service';
import { ChallengeCardComponent } from './challenge-card.component';

class StubVideoProofService {
  available = true;
  readonly ids = signal<Set<string>>(new Set());
  readonly saveCalls: Array<{ id: string; file: Blob }> = [];
  readonly removeCalls: string[] = [];
  private readonly blobs = new Map<string, Blob>();

  hasVideo(id: string): boolean {
    return this.ids().has(id);
  }

  async save(id: string, file: Blob): Promise<void> {
    this.blobs.set(id, file);
    this.ids.update((set) => new Set(set).add(id));
    this.saveCalls.push({ id, file });
  }

  async get(id: string): Promise<Blob | null> {
    return this.blobs.get(id) ?? null;
  }

  async remove(id: string): Promise<void> {
    this.blobs.delete(id);
    this.ids.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
    this.removeCalls.push(id);
  }
}

@Component({
  standalone: true,
  imports: [ChallengeCardComponent],
  template: `
    <app-challenge-card
      [challenge]="challenge()"
      [completed]="completed()"
      (toggled)="onToggled($event)"
    />
  `,
})
class HostComponent {
  readonly challenge = signal<Challenge>(CHALLENGES[0]);
  readonly completed = signal(false);
  readonly toggledIds: string[] = [];
  onToggled(id: string): void {
    this.toggledIds.push(id);
  }
}

describe('ChallengeCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let videoService: StubVideoProofService;

  beforeEach(async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    videoService = new StubVideoProofService();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: VideoProofService, useValue: videoService }],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function card(): HTMLElement {
    return fixture.nativeElement.querySelector('.card');
  }

  function toggleArea(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.toggle-area');
  }

  function proofBtn(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.proof-btn');
  }

  it('renders the challenge title and description', () => {
    expect(fixture.nativeElement.querySelector('.title').textContent).toContain('Отжимания');
    expect(fixture.nativeElement.querySelector('.desc').textContent).toContain(
      '35 раз за подход',
    );
  });

  it('renders the pixel icon for the challenge', () => {
    expect(fixture.nativeElement.querySelector('app-pixel-icon')).toBeTruthy();
  });

  it('shows the pending badge and dim state when not completed', () => {
    expect(card().classList.contains('done')).toBe(false);
    expect(fixture.nativeElement.querySelector('.status-pending')).toBeTruthy();
  });

  it('shows the done badge and vivid state when completed', async () => {
    host.completed.set(true);
    await fixture.whenStable();

    expect(card().classList.contains('done')).toBe(true);
    expect(fixture.nativeElement.querySelector('.status-done')).toBeTruthy();
  });

  it('emits toggled with the challenge id when clicked', () => {
    toggleArea().click();
    expect(host.toggledIds).toEqual(['pushups']);
  });

  it('applies a burst animation class right after completing', async () => {
    expect(host.completed()).toBe(false);
    toggleArea().click();
    await fixture.whenStable();
    expect(card().classList.contains('burst')).toBe(true);
  });

  it('does not apply the burst class when un-completing', async () => {
    host.completed.set(true);
    await fixture.whenStable();
    toggleArea().click();
    await fixture.whenStable();
    expect(card().classList.contains('burst')).toBe(false);
  });

  describe('video proof (available)', () => {
    it('renders the proof button and hidden file input', () => {
      expect(proofBtn()).toBeTruthy();
      expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeTruthy();
    });

    it('does not force the camera — the file input has no "capture" attribute, so the OS picker offers the gallery', () => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
      expect(input.hasAttribute('capture')).toBe(false);
    });

    it('is dim (no has-video class) when no proof is attached', () => {
      expect(proofBtn()!.classList.contains('has-video')).toBe(false);
    });

    it('clicking the proof button opens the native file picker when no video is attached', () => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
      const clickSpy = vi.spyOn(input, 'click');

      proofBtn()!.click();

      expect(clickSpy).toHaveBeenCalledOnce();
    });

    it('selecting a file saves it via VideoProofService and opens the viewer', async () => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
      const file = new File(['clip'], 'proof.webm', { type: 'video/webm' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });

      input.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(videoService.saveCalls).toHaveLength(1);
      expect(videoService.saveCalls[0].id).toBe('pushups');
      expect(fixture.nativeElement.querySelector('app-video-modal')).toBeTruthy();
    });

    it('lights up the proof button once a video is attached', async () => {
      await videoService.save('pushups', new File(['x'], 'x.webm'));
      videoService.ids.set(new Set(videoService.ids()));
      await fixture.whenStable();

      expect(proofBtn()!.classList.contains('has-video')).toBe(true);
    });

    it('clicking the proof button opens the viewer directly when a video already exists', async () => {
      await videoService.save('pushups', new File(['x'], 'x.webm'));
      await fixture.whenStable();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
      const clickSpy = vi.spyOn(input, 'click');

      proofBtn()!.click();
      await fixture.whenStable();

      expect(clickSpy).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('app-video-modal')).toBeTruthy();
    });

    it('removeRequested from the modal deletes the proof and closes the viewer', async () => {
      await videoService.save('pushups', new File(['x'], 'x.webm'));
      await fixture.whenStable();
      proofBtn()!.click();
      await fixture.whenStable();

      const modal: HTMLElement = fixture.nativeElement.querySelector('app-video-modal');
      const removeBtn = Array.from(modal.querySelectorAll('.btn')).find(
        (b) => b.textContent?.trim() === 'Удалить',
      ) as HTMLButtonElement;
      removeBtn.click();
      await fixture.whenStable();

      expect(videoService.removeCalls).toEqual(['pushups']);
      expect(fixture.nativeElement.querySelector('app-video-modal')).toBeFalsy();
      expect(proofBtn()!.classList.contains('has-video')).toBe(false);
    });

    it('replaceRequested from the modal closes the viewer and reopens the file picker', async () => {
      await videoService.save('pushups', new File(['x'], 'x.webm'));
      await fixture.whenStable();
      proofBtn()!.click();
      await fixture.whenStable();

      const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
      const clickSpy = vi.spyOn(input, 'click');

      const modal: HTMLElement = fixture.nativeElement.querySelector('app-video-modal');
      const replaceBtn = Array.from(modal.querySelectorAll('.btn')).find(
        (b) => b.textContent?.trim() === 'Заменить',
      ) as HTMLButtonElement;
      replaceBtn.click();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('app-video-modal')).toBeFalsy();
      expect(clickSpy).toHaveBeenCalledOnce();
    });
  });

  describe('video proof (unavailable)', () => {
    beforeEach(async () => {
      videoService.available = false;
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [{ provide: VideoProofService, useValue: videoService }],
      }).compileComponents();
      fixture = TestBed.createComponent(HostComponent);
      host = fixture.componentInstance;
      fixture.autoDetectChanges();
      await fixture.whenStable();
    });

    it('does not render the proof button when IndexedDB is unavailable', () => {
      expect(proofBtn()).toBeFalsy();
      expect(fixture.nativeElement.querySelector('input[type="file"]')).toBeFalsy();
    });
  });
});
