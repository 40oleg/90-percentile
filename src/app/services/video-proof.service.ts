import { Injectable, signal } from '@angular/core';

const DB_NAME = '90percentile-proofs';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

/**
 * Stores challenge "proof" video clips as Blobs in IndexedDB (localStorage
 * is far too small for video). Presence is optional and independent of the
 * completed/incomplete state — a challenge can be marked done with or
 * without a clip attached.
 */
@Injectable({ providedIn: 'root' })
export class VideoProofService {
  readonly available = typeof indexedDB !== 'undefined';
  readonly ids = signal<Set<string>>(new Set());

  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (this.available) {
      void this.loadIds();
    }
  }

  hasVideo(id: string): boolean {
    return this.ids().has(id);
  }

  async save(id: string, file: Blob): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.ids.update((set) => new Set(set).add(id));
  }

  async get(id: string): Promise<Blob | null> {
    const db = await this.openDb();
    return new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async remove(id: string): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.ids.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  private async loadIds(): Promise<void> {
    try {
      const db = await this.openDb();
      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAllKeys();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      this.ids.set(new Set(keys.map(String)));
    } catch {
      /* IndexedDB unavailable (e.g. private browsing) — proof feature stays inert */
    }
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.available) {
      return Promise.reject(new Error('IndexedDB is not available'));
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE_NAME)) {
            req.result.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }
}
