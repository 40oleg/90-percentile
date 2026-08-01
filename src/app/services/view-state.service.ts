import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = '90percentile.view';

export type AppView = 'challenges' | 'calories';

const VIEWS: readonly AppView[] = ['challenges', 'calories'];

/** Which screen the app shows, remembered across launches. */
@Injectable({ providedIn: 'root' })
export class ViewStateService {
  readonly view = signal<AppView>(this.loadView());

  constructor() {
    effect(() => {
      const current = this.view();
      try {
        localStorage.setItem(STORAGE_KEY, current);
      } catch {
        /* storage unavailable — the app just always opens on the last default */
      }
    });
  }

  setView(view: AppView): void {
    this.view.set(view);
  }

  private loadView(): AppView {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return VIEWS.includes(raw as AppView) ? (raw as AppView) : 'challenges';
    } catch {
      return 'challenges';
    }
  }
}
