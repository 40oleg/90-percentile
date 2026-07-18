import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { VideoModalComponent } from './video-modal.component';

@Component({
  standalone: true,
  imports: [VideoModalComponent],
  template: `
    <app-video-modal
      [videoUrl]="url"
      (closed)="closedCount = closedCount + 1"
      (replaceRequested)="replaceCount = replaceCount + 1"
      (removeRequested)="removeCount = removeCount + 1"
    />
  `,
})
class HostComponent {
  url = 'blob:fake-url';
  closedCount = 0;
  replaceCount = 0;
  removeCount = 0;
}

describe('VideoModalComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders a video element with the given src', () => {
    const video: HTMLVideoElement = fixture.nativeElement.querySelector('video');
    expect(video).toBeTruthy();
    expect(video.src).toContain('blob:fake-url');
  });

  it('emits closed when the backdrop itself is clicked', () => {
    const backdrop: HTMLElement = fixture.nativeElement.querySelector('.backdrop');
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.closedCount).toBe(1);
  });

  it('does not emit closed when the panel is clicked', () => {
    const panel: HTMLElement = fixture.nativeElement.querySelector('.panel');
    panel.click();
    expect(host.closedCount).toBe(0);
  });

  it('emits closed when the "Закрыть" button is clicked', () => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.btn'),
    );
    buttons.find((b) => b.textContent?.trim() === 'Закрыть')!.click();
    expect(host.closedCount).toBe(1);
  });

  it('emits replaceRequested when "Заменить" is clicked', () => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.btn'),
    );
    buttons.find((b) => b.textContent?.trim() === 'Заменить')!.click();
    expect(host.replaceCount).toBe(1);
  });

  it('emits removeRequested when "Удалить" is clicked', () => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.btn'),
    );
    buttons.find((b) => b.textContent?.trim() === 'Удалить')!.click();
    expect(host.removeCount).toBe(1);
  });
});
