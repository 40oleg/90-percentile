import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-video-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './video-modal.component.html',
  styleUrl: './video-modal.component.scss',
})
export class VideoModalComponent {
  readonly videoUrl = input.required<string>();
  readonly closed = output<void>();
  readonly replaceRequested = output<void>();
  readonly removeRequested = output<void>();

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}
