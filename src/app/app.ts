import { ChangeDetectionStrategy, Component, HostListener } from '@angular/core';
import { ChallengeStateService, FilterMode } from './services/challenge-state.service';
import { SoundService } from './services/sound.service';
import { AppView, ViewStateService } from './services/view-state.service';
import { ChallengeCardComponent } from './components/challenge-card/challenge-card.component';
import { FilterBarComponent } from './components/filter-bar/filter-bar.component';
import { NavMenuComponent } from './components/nav-menu/nav-menu.component';
import { CaloriePageComponent } from './components/calorie-page/calorie-page.component';
import { QuizPageComponent } from './components/quiz-page/quiz-page.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ChallengeCardComponent,
    FilterBarComponent,
    NavMenuComponent,
    CaloriePageComponent,
    QuizPageComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private audioUnlocked = false;

  constructor(
    protected readonly state: ChallengeStateService,
    protected readonly sound: SoundService,
    protected readonly view: ViewStateService,
  ) {}

  @HostListener('document:pointerdown')
  onFirstInteraction(): void {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    this.sound.playClick();
  }

  onToggle(id: string): void {
    const willComplete = !this.state.isCompleted(id);
    this.state.toggle(id);
    if (willComplete) {
      this.sound.playComplete();
    } else {
      this.sound.playUndo();
    }
  }

  onFilterChange(mode: FilterMode): void {
    this.state.setFilter(mode);
    this.sound.playClick();
  }

  onViewChange(view: AppView): void {
    this.view.setView(view);
    this.sound.playClick();
  }

  onMuteToggle(): void {
    this.sound.toggleMuted();
  }
}
