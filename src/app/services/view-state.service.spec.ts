import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewStateService } from './view-state.service';

const KEY = '90percentile.view';

describe('ViewStateService', () => {
  let service: ViewStateService;

  function freshService(): ViewStateService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ViewStateService);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ViewStateService);
  });

  it('defaults to the challenges view', () => {
    expect(service.view()).toBe('challenges');
  });

  it('setView switches the active view', () => {
    service.setView('calories');
    expect(service.view()).toBe('calories');
  });

  it('persists the selected view to localStorage', () => {
    service.setView('calories');
    TestBed.tick();

    expect(localStorage.getItem(KEY)).toBe('calories');
  });

  it('restores the last selected view on a fresh start', () => {
    service.setView('calories');
    TestBed.tick();

    expect(freshService().view()).toBe('calories');
  });

  it('restores the challenges view when it was the last selected one', () => {
    localStorage.setItem(KEY, 'challenges');

    expect(freshService().view()).toBe('challenges');
  });

  it('falls back to challenges for an unknown stored value', () => {
    localStorage.setItem(KEY, 'nonsense');

    expect(freshService().view()).toBe('challenges');
  });

  it('survives localStorage.getItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(freshService().view()).toBe('challenges');
    spy.mockRestore();
  });

  it('survives localStorage.setItem throwing', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    const fresh = freshService();
    expect(() => {
      fresh.setView('calories');
      TestBed.tick();
    }).not.toThrow();
    expect(fresh.view()).toBe('calories');

    spy.mockRestore();
  });
});
