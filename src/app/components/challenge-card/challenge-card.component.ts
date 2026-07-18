import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Challenge } from '../../models/challenge.model';
import { VideoProofService } from '../../services/video-proof.service';
import { PixelIconComponent } from '../pixel-icon/pixel-icon.component';
import { VideoModalComponent } from '../video-modal/video-modal.component';

@Component({
  selector: 'app-challenge-card',
  standalone: true,
  imports: [PixelIconComponent, VideoModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './challenge-card.component.html',
  styleUrl: './challenge-card.component.scss',
})
export class ChallengeCardComponent {
  private readonly videoProof = inject(VideoProofService);
  private readonly destroyRef = inject(DestroyRef);

  readonly challenge = input.required<Challenge>();
  readonly completed = input.required<boolean>();
  readonly toggled = output<string>();

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly bursting = signal(false);
  protected readonly videoUrl = signal<string | null>(null);
  protected readonly videoBusy = signal(false);

  protected readonly categoryClass = computed(() => `cat-${this.challenge().category}`);
  protected readonly hasVideo = computed(() => this.videoProof.ids().has(this.challenge().id));
  protected readonly videoAvailable = this.videoProof.available;

  constructor() {
    this.destroyRef.onDestroy(() => this.releaseObjectUrl());
  }

  onToggle(): void {
    this.toggled.emit(this.challenge().id);
    if (!this.completed()) {
      this.bursting.set(true);
      setTimeout(() => this.bursting.set(false), 500);
    }
  }

  onProofButtonClick(): void {
    if (this.hasVideo()) {
      void this.openViewer();
    } else {
      this.fileInput()?.nativeElement.click();
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.videoBusy.set(true);
    try {
      await this.videoProof.save(this.challenge().id, file);
      await this.openViewer();
    } finally {
      this.videoBusy.set(false);
    }
  }

  onReplaceRequested(): void {
    this.closeViewer();
    this.fileInput()?.nativeElement.click();
  }

  async onRemoveRequested(): Promise<void> {
    await this.videoProof.remove(this.challenge().id);
    this.closeViewer();
  }

  closeViewer(): void {
    this.releaseObjectUrl();
    this.videoUrl.set(null);
  }

  private async openViewer(): Promise<void> {
    const blob = await this.videoProof.get(this.challenge().id);
    if (!blob) return;
    this.releaseObjectUrl();
    this.videoUrl.set(URL.createObjectURL(blob));
  }

  private releaseObjectUrl(): void {
    const current = this.videoUrl();
    if (current) URL.revokeObjectURL(current);
  }
}
