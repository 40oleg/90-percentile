import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FilterMode } from '../../services/challenge-state.service';

interface FilterOption {
  mode: FilterMode;
  label: string;
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filter-bar" role="tablist">
      @for (opt of options; track opt.mode) {
        <button
          type="button"
          role="tab"
          class="filter-btn"
          [class.active]="active() === opt.mode"
          [attr.aria-selected]="active() === opt.mode"
          (click)="select(opt.mode)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent {
  readonly active = input.required<FilterMode>();
  readonly changed = output<FilterMode>();

  protected readonly options: FilterOption[] = [
    { mode: 'all', label: 'ВСЕ' },
    { mode: 'incomplete', label: 'В ПРОЦЕССЕ' },
    { mode: 'completed', label: 'ГОТОВО' },
  ];

  select(mode: FilterMode): void {
    this.changed.emit(mode);
  }
}
