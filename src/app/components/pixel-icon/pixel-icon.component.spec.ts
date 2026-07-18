import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { IconKey } from '../../models/challenge.model';
import { PIXEL_ICONS } from '../../data/pixel-icons.data';
import { PixelIconComponent } from './pixel-icon.component';

@Component({
  standalone: true,
  imports: [PixelIconComponent],
  template: `<app-pixel-icon [icon]="icon" />`,
})
class HostComponent {
  icon: IconKey = 'heart';
}

describe('PixelIconComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
  });

  it('renders exactly 64 pixel cells for an 8x8 sprite', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const cells = fixture.nativeElement.querySelectorAll('.px');
    expect(cells.length).toBe(64);
  });

  it('marks the correct cells as filled for the "heart" icon', async () => {
    host.icon = 'heart';
    fixture.detectChanges();
    await fixture.whenStable();

    const expectedFilled = PIXEL_ICONS['heart'].join('').split('').filter((c) => c === '1').length;
    const filledCells = fixture.nativeElement.querySelectorAll('.px.filled');
    expect(filledCells.length).toBe(expectedFilled);
  });

  it('renders a different fill pattern per icon', async () => {
    host.icon = 'run';
    fixture.detectChanges();
    await fixture.whenStable();
    const runFilled = fixture.nativeElement.querySelectorAll('.px.filled').length;

    const other = TestBed.createComponent(HostComponent);
    other.componentInstance.icon = 'ruler';
    other.detectChanges();
    await other.whenStable();
    const rulerFilled = other.nativeElement.querySelectorAll('.px.filled').length;

    expect(runFilled).not.toBe(rulerFilled);
  });
});
