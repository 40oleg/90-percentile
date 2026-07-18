import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { Challenge } from '../../models/challenge.model';
import { PixelIconComponent } from '../pixel-icon/pixel-icon.component';

@Component({
  selector: 'app-challenge-card',
  standalone: true,
  imports: [PixelIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './challenge-card.component.html',
  styleUrl: './challenge-card.component.scss',
})
export class ChallengeCardComponent {
  readonly challenge = input.required<Challenge>();
  readonly completed = input.required<boolean>();
  readonly toggled = output<string>();

  protected readonly bursting = signal(false);

  protected readonly categoryClass = computed(() => `cat-${this.challenge().category}`);

  onToggle(): void {
    this.toggled.emit(this.challenge().id);
    if (!this.completed()) {
      this.bursting.set(true);
      setTimeout(() => this.bursting.set(false), 500);
    }
  }
}
