import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  CATEGORY_LABELS,
  SLOT_LABELS,
  classify,
  PressureCategory,
} from '../../models/pressure-entry.model';
import { PRESSURE_LIMITS, PressureService } from '../../services/pressure.service';
import { SoundService } from '../../services/sound.service';
import { PressureChartComponent } from '../pressure-chart/pressure-chart.component';

/** Categories worth a warning sound instead of the usual confirmation blip. */
const ALARMING: readonly PressureCategory[] = ['high2', 'low'];

/** The blood-pressure diary: three fields in, two charts and an average out. */
@Component({
  selector: 'app-pressure-page',
  standalone: true,
  imports: [PressureChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pressure-page.component.html',
  styleUrl: './pressure-page.component.scss',
})
export class PressurePageComponent {
  protected readonly pressure = inject(PressureService);
  private readonly sound = inject(SoundService);

  protected readonly limits = PRESSURE_LIMITS;
  protected readonly slotLabels = SLOT_LABELS;

  protected readonly systolic = signal('');
  protected readonly diastolic = signal('');
  protected readonly pulse = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly average = this.pressure.windowAverage;
  protected readonly morning = this.pressure.morningAverage;
  protected readonly evening = this.pressure.eveningAverage;

  protected readonly categoryLabel = computed(() => {
    const category = this.pressure.category();
    return category === null ? '—' : CATEGORY_LABELS[category];
  });

  /** Drives the colour of the average panel: `normal`, `high2`, … */
  protected readonly categoryClass = computed(() => this.pressure.category() ?? 'none');

  protected readonly slotHint = computed(() => SLOT_LABELS[this.pressure.currentSlot()]);

  protected onInput(field: 'systolic' | 'diastolic' | 'pulse', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this[field].set(value);
    if (this.error()) this.error.set(null);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submit();
  }

  protected submit(): void {
    const sys = parseField(this.systolic());
    const dia = parseField(this.diastolic());
    const bpm = parseField(this.pulse());

    if (sys === null || dia === null || bpm === null) {
      this.error.set('Заполни все три поля целыми числами.');
      return;
    }
    const limitError =
      outOfRange('Верхнее', sys, PRESSURE_LIMITS.systolic) ??
      outOfRange('Нижнее', dia, PRESSURE_LIMITS.diastolic) ??
      outOfRange('Пульс', bpm, PRESSURE_LIMITS.pulse);
    if (limitError) {
      this.error.set(limitError);
      return;
    }
    if (sys <= dia) {
      this.error.set('Верхнее должно быть больше нижнего.');
      return;
    }
    if (!this.pressure.add(sys, dia, bpm)) {
      this.error.set('Не получилось записать замер. Проверь числа.');
      return;
    }

    this.systolic.set('');
    this.diastolic.set('');
    this.pulse.set('');
    this.error.set(null);

    if (ALARMING.includes(classify(sys, dia))) {
      this.sound.playWarn();
    } else {
      this.sound.playAdd();
    }
  }
}

/** A field is only good for a whole positive number — anything else is a miss. */
function parseField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function outOfRange(
  name: string,
  value: number,
  limits: { min: number; max: number },
): string | null {
  if (value >= limits.min && value <= limits.max) return null;
  return `${name}: от ${limits.min} до ${limits.max}.`;
}
