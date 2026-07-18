import { describe, expect, it } from 'vitest';
import { CHALLENGES } from './challenges.data';
import { PIXEL_ICONS } from './pixel-icons.data';

describe('CHALLENGES', () => {
  it('is not empty', () => {
    expect(CHALLENGES.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a title and description for every challenge', () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.title.trim().length).toBeGreaterThan(0);
      expect(challenge.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('references only icon keys that exist in PIXEL_ICONS', () => {
    for (const challenge of CHALLENGES) {
      expect(PIXEL_ICONS[challenge.icon]).toBeDefined();
    }
  });

  it('assigns a known category to every challenge', () => {
    const known = new Set(['strength', 'endurance', 'power', 'mobility', 'composition']);
    for (const challenge of CHALLENGES) {
      expect(known.has(challenge.category)).toBe(true);
    }
  });
});
