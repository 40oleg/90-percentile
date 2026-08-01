import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { NavMenuComponent } from './nav-menu.component';
import { AppView } from '../../services/view-state.service';

@Component({
  standalone: true,
  imports: [NavMenuComponent],
  template: `<app-nav-menu [active]="active()" (changed)="onChanged($event)" />`,
})
class HostComponent {
  readonly active = signal<AppView>('challenges');
  emitted: AppView[] = [];

  onChanged(view: AppView): void {
    this.emitted.push(view);
  }
}

describe('NavMenuComponent', () => {
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
    return Array.from(fixture.nativeElement.querySelectorAll('.nav-btn'));
  }

  function button(label: string): HTMLButtonElement {
    return buttons().find((b) => b.textContent?.includes(label))!;
  }

  it('renders one button per section', () => {
    expect(buttons()).toHaveLength(2);
    expect(button('ЧЕЛЛЕНДЖИ')).toBeTruthy();
    expect(button('ККАЛ')).toBeTruthy();
  });

  it('marks the active section', () => {
    expect(button('ЧЕЛЛЕНДЖИ').classList.contains('active')).toBe(true);
    expect(button('ККАЛ').classList.contains('active')).toBe(false);
  });

  it('exposes the active section to assistive tech', () => {
    expect(button('ЧЕЛЛЕНДЖИ').getAttribute('aria-current')).toBe('page');
    expect(button('ККАЛ').getAttribute('aria-current')).toBeNull();
  });

  it('emits the selected section', async () => {
    button('ККАЛ').click();
    await fixture.whenStable();

    expect(host.emitted).toEqual(['calories']);
  });

  it('does not re-emit when the active section is clicked again', async () => {
    button('ЧЕЛЛЕНДЖИ').click();
    await fixture.whenStable();

    expect(host.emitted).toEqual([]);
  });

  it('moves the active marker when the input changes', async () => {
    host.active.set('calories');
    await fixture.whenStable();

    expect(button('ККАЛ').classList.contains('active')).toBe(true);
    expect(button('ЧЕЛЛЕНДЖИ').classList.contains('active')).toBe(false);
  });

  it('uses buttons of type=button so it never submits a form', () => {
    for (const btn of buttons()) {
      expect(btn.getAttribute('type')).toBe('button');
    }
  });
});
