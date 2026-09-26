import { describe, expect, it } from 'vitest';
import { ImportError, exportPayload, normalizeState } from './storage';
import { createSeedState } from './seed';

describe('import / export', () => {
  it('round-trips an exported backup', () => {
    const s = createSeedState(new Date('2026-09-26T08:00:00'));
    const back = normalizeState(JSON.parse(exportPayload(s)));
    expect(back.topics).toHaveLength(s.topics.length);
    expect(back.cards).toHaveLength(s.cards.length);
    expect(back.settings).toEqual(s.settings);
  });

  it('rejects files that are not Synapse backups', () => {
    expect(() => normalizeState([1, 2, 3])).toThrow(ImportError);
    expect(() => normalizeState({ hello: 'world' })).toThrow(ImportError);
  });

  it('drops cards pointing at missing topics and fills defaults', () => {
    const s = normalizeState({
      topics: [{ id: 't1', title: 'X' }],
      cards: [
        { id: 'c1', topicId: 't1', srs: {} },
        { id: 'c2', topicId: 'missing', srs: {} }
      ]
    });
    expect(s.cards.map((c) => c.id)).toEqual(['c1']);
    expect(s.cards[0].srs.ease).toBe(2.5);
    expect(s.settings.blurtDurationSec).toBe(180);
  });
});
