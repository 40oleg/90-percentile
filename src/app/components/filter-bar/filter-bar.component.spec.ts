import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FilterMode } from '../../services/challenge-state.service';
import { FilterBarComponent } from './filter-bar.component';

@Component({
  standalone: true,
  imports: [FilterBarComponent],
  template: `<app-filter-bar [active]="active()" (changed)="onChanged($event)" />`,
})
class HostComponent {
  readonly active = signal<FilterMode>('all');
  lastChanged: FilterMode | null = null;
  onChanged(mode: FilterMode): void {
    this.lastChanged = mode;
  }
}

describe('FilterBarComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.filter-btn'));
  }

  it('renders three filter buttons', () => {
    expect(buttons().length).toBe(3);
  });

  it('renders the expected labels', () => {
    const labels = buttons().map((b) => b.textContent?.trim());
    expect(labels).toEqual(['ВСЕ', 'В ПРОЦЕССЕ', 'ГОТОВО']);
  });

  it('marks the button matching "active" as active', async () => {
    host.active.set('completed');
    await fixture.whenStable();

    const active = buttons().find((b) => b.classList.contains('active'));
    expect(active?.textContent?.trim()).toBe('ГОТОВО');
  });

  it('emits "changed" with the clicked mode', () => {
    buttons()[2].click();
    expect(host.lastChanged).toBe('completed');

    buttons()[1].click();
    expect(host.lastChanged).toBe('incomplete');
  });

  it('sets aria-selected on the active tab', async () => {
    host.active.set('incomplete');
    await fixture.whenStable();

    const active = buttons().find((b) => b.getAttribute('aria-selected') === 'true');
    expect(active?.textContent?.trim()).toBe('В ПРОЦЕССЕ');
  });
});
