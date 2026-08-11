import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { WeightRangeId, formatDelta, formatKg } from '../../models/weight-entry.model';
import { WEIGHT_LIMITS, WeightService } from '../../services/weight.service';
import { SoundService } from '../../services/sound.service';
import { WeightChartComponent } from '../weight-chart/weight-chart.component';

/** The weight section: one field in, one chart over the chosen stretch out. */
@Component({
  selector: 'app-weight-page',
  standalone: true,
  imports: [WeightChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './weight-page.component.html',
  styleUrl: './weight-page.component.scss',
})
export class WeightPageComponent {
  protected readonly weight = inject(WeightService);
  private readonly sound = inject(SoundService);

  protected readonly limits = WEIGHT_LIMITS;

  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly current = computed(() => {
    const kg = this.weight.currentKg();
    return kg === null ? null : formatKg(kg);
  });

  protected readonly change = computed(() => {
    const change = this.weight.change();
    return change === null ? null : formatDelta(change);
  });

  /** Down is the good direction here, so a loss is green and a gain is red. */
  protected readonly changeClass = computed(() => {
    const change = this.weight.change();
    if (change === null || change === 0) return 'flat';
    return change < 0 ? 'down' : 'up';
  });

  protected readonly min = computed(() => {
    const kg = this.weight.minKg();
    return kg === null ? null : formatKg(kg);
  });

  protected readonly max = computed(() => {
    const kg = this.weight.maxKg();
    return kg === null ? null : formatKg(kg);
  });

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
    if (this.error()) this.error.set(null);
  }

  protected onSelectRange(id: WeightRangeId): void {
    if (id === this.weight.rangeId()) return;
    this.weight.selectRange(id);
    this.sound.playClick();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submit();
  }

  protected submit(): void {
    // A comma is what the phone keyboard offers first, so accept both separators.
    const raw = this.draft().trim().replace(',', '.');
    const kg = Number(raw);

    if (raw === '' || !Number.isFinite(kg)) {
      this.error.set('Введи вес числом, например 74.5.');
      return;
    }
    if (!this.weight.add(kg)) {
      this.error.set(`Вес: от ${WEIGHT_LIMITS.min} до ${WEIGHT_LIMITS.max} кг.`);
      return;
    }

    this.draft.set('');
    this.error.set(null);
    this.sound.playAdd();
  }
}
