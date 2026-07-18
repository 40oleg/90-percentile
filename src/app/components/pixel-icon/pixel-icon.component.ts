import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PIXEL_ICONS } from '../../data/pixel-icons.data';
import { IconKey } from '../../models/challenge.model';

interface Cell {
  filled: boolean;
}

@Component({
  selector: 'app-pixel-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pixel-icon" [style.--cols]="8">
      @for (cell of cells(); track $index) {
        <span class="px" [class.filled]="cell.filled"></span>
      }
    </div>
  `,
  styles: `
    .pixel-icon {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      grid-template-rows: repeat(8, 1fr);
      width: 100%;
      height: 100%;
    }
    .px {
      width: 100%;
      height: 100%;
    }
    .px.filled {
      background: currentColor;
    }
  `,
})
export class PixelIconComponent {
  readonly icon = input.required<IconKey>();

  readonly cells = computed<Cell[]>(() => {
    const pattern = PIXEL_ICONS[this.icon()];
    const cells: Cell[] = [];
    for (const row of pattern) {
      for (const char of row) {
        cells.push({ filled: char === '1' });
      }
    }
    return cells;
  });
}
