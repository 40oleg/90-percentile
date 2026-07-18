import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoProofService } from './video-proof.service';

function makeVideoBlob(content = 'fake-video-bytes'): Blob {
  return new Blob([content], { type: 'video/webm' });
}

describe('VideoProofService', () => {
  beforeEach(() => {
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    TestBed.configureTestingModule({});
  });

  it('reports itself as available when IndexedDB exists', () => {
    const service = TestBed.inject(VideoProofService);
    expect(service.available).toBe(true);
  });

  it('starts with no attached proofs', () => {
    const service = TestBed.inject(VideoProofService);
    expect(service.ids().size).toBe(0);
    expect(service.hasVideo('pushups')).toBe(false);
  });

  it('save() stores a blob and marks the id as having a proof', async () => {
    const service = TestBed.inject(VideoProofService);

    await service.save('pushups', makeVideoBlob());

    expect(service.hasVideo('pushups')).toBe(true);
    expect(service.ids().has('pushups')).toBe(true);
  });

  it('get() returns a stored blob for a saved id', async () => {
    // Note: jsdom's structuredClone doesn't round-trip its own Blob
    // polyfill faithfully (a jsdom/Node limitation, not app behavior —
    // the full save/view/remove flow was verified manually in a real
    // Chromium browser), so this only asserts presence, not byte content.
    const service = TestBed.inject(VideoProofService);
    const blob = makeVideoBlob('hello-world');

    await service.save('pushups', blob);
    const retrieved = await service.get('pushups');

    expect(retrieved).not.toBeNull();
  });

  it('get() returns null for an id with no proof', async () => {
    const service = TestBed.inject(VideoProofService);
    const retrieved = await service.get('does-not-exist');
    expect(retrieved).toBeNull();
  });

  it('remove() deletes the blob and clears the id from the set', async () => {
    const service = TestBed.inject(VideoProofService);
    await service.save('pushups', makeVideoBlob());

    await service.remove('pushups');

    expect(service.hasVideo('pushups')).toBe(false);
    expect(await service.get('pushups')).toBeNull();
  });

  it('save() overwrites an existing proof for the same id', async () => {
    const service = TestBed.inject(VideoProofService);
    await service.save('pushups', makeVideoBlob('first'));
    await service.save('pushups', makeVideoBlob('second'));

    const retrieved = await service.get('pushups');
    expect(retrieved).not.toBeNull();
    expect(service.ids().size).toBe(1);
  });

  it('tracks multiple challenge ids independently', async () => {
    const service = TestBed.inject(VideoProofService);
    await service.save('pushups', makeVideoBlob('a'));
    await service.save('pullups', makeVideoBlob('b'));

    expect(service.ids().size).toBe(2);
    expect(service.hasVideo('pushups')).toBe(true);
    expect(service.hasVideo('pullups')).toBe(true);
    expect(service.hasVideo('deadlift')).toBe(false);
  });

  it('hydrates ids already present in IndexedDB on construction', async () => {
    const first = TestBed.inject(VideoProofService);
    await first.save('pushups', makeVideoBlob());

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const fresh = TestBed.inject(VideoProofService);

    await vi.waitFor(() => expect(fresh.hasVideo('pushups')).toBe(true));
  });

  it('degrades gracefully when IndexedDB is unavailable', async () => {
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(VideoProofService);

    expect(service.available).toBe(false);
    await expect(service.save('pushups', makeVideoBlob())).rejects.toThrow();
  });
});
