import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppView } from '../../services/view-state.service';

interface NavOption {
  view: AppView;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-nav-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="nav-menu" aria-label="Разделы">
      @for (opt of options; track opt.view) {
        <button
          type="button"
          class="nav-btn"
          [class.active]="active() === opt.view"
          [attr.aria-current]="active() === opt.view ? 'page' : null"
          (click)="select(opt.view)"
        >
          <span class="nav-icon" aria-hidden="true">{{ opt.icon }}</span>
          {{ opt.label }}
        </button>
      }
    </nav>
  `,
  styleUrl: './nav-menu.component.scss',
})
export class NavMenuComponent {
  readonly active = input.required<AppView>();
  readonly changed = output<AppView>();

  protected readonly options: NavOption[] = [
    { view: 'challenges', label: 'ЧЕЛЛЕНДЖИ', icon: '🏆' },
    { view: 'calories', label: 'ККАЛ', icon: '🍞' },
    { view: 'quiz', label: 'ТЕСТ', icon: '🧠' },
  ];

  select(view: AppView): void {
    if (view !== this.active()) this.changed.emit(view);
  }
}
