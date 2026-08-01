import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CalorieService, MAX_ENTRY_KCAL } from '../../services/calorie.service';
import { SoundService } from '../../services/sound.service';
import { CalorieLogComponent } from '../calorie-log/calorie-log.component';

/** One-tap amounts for the things you eat without weighing them. */
const QUICK_ADD = [100, 250, 500, 1000] as const;

@Component({
  selector: 'app-calorie-page',
  standalone: true,
  imports: [CalorieLogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calorie-page.component.html',
  styleUrl: './calorie-page.component.scss',
})
export class CaloriePageComponent {
  protected readonly calories = inject(CalorieService);
  private readonly sound = inject(SoundService);

  protected readonly quickAdd = QUICK_ADD;
  protected readonly maxEntry = MAX_ENTRY_KCAL;

  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly average = this.calories.dailyAverage;
  protected readonly overNorm = this.calories.overNorm;

  /** How full the day's budget is, capped at 100% so the bar never overflows. */
  protected readonly normFill = computed(() =>
    Math.min(100, Math.round((this.average() / this.calories.norm) * 100)),
  );

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    if (this.error()) this.error.set(null);
  }

  protected onQuickAdd(kcal: number): void {
    const current = Number.parseInt(this.draft(), 10);
    const next = Number.isFinite(current) && current > 0 ? current + kcal : kcal;
    this.draft.set(String(Math.min(next, MAX_ENTRY_KCAL)));
    this.error.set(null);
    this.sound.playClick();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submit();
  }

  protected submit(): void {
    const raw = this.draft().trim();
    const kcal = Number(raw);

    if (raw === '' || !Number.isFinite(kcal) || kcal <= 0) {
      this.error.set('Введи положительное число ккал.');
      return;
    }
    if (Math.round(kcal) > MAX_ENTRY_KCAL) {
      this.error.set(`Многовато. Максимум ${MAX_ENTRY_KCAL} ккал за раз.`);
      return;
    }
    if (!this.calories.add(kcal)) {
      this.error.set('Введи положительное число ккал.');
      return;
    }

    this.draft.set('');
    this.error.set(null);
    if (this.overNorm()) {
      this.sound.playWarn();
    } else {
      this.sound.playAdd();
    }
  }

  protected onRemove(id: string): void {
    this.calories.remove(id);
    this.sound.playUndo();
  }
}
