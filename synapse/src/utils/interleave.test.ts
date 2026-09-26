import { describe, expect, it } from 'vitest';
import { buildDailyDeck, interleaveOrder, switchRate } from './interleave';
import { createSeedState } from './seed';
import type { Card } from '../types';

describe('interleaving', () => {
  it('never places two same-topic items adjacent when avoidable', () => {
    const items = ['a', 'a', 'a', 'b', 'b', 'c', 'c'].map((t, i) => ({ t, i }));
    const ordered = interleaveOrder(items, (x) => x.t, (x) => x.t);
    for (let i = 1; i < ordered.length; i++) expect(ordered[i].t).not.toBe(ordered[i - 1].t);
    expect(switchRate(ordered, (x) => x.t)).toBe(1);
  });

  it('pulls cards forward so the deck spans the minimum number of topics', () => {
    const state = createSeedState(new Date('2026-09-26T08:00:00'));
    const now = new Date('2026-09-26T08:00:00');
    // Make only one topic due.
    const onlyFirst: Card[] = state.cards.map((c) =>
      c.topicId === state.topics[0].id
        ? { ...c, srs: { ...c.srs, due: new Date(now.getTime() - 1000).toISOString() } }
        : { ...c, srs: { ...c.srs, due: new Date(now.getTime() + 5 * 86_400_000).toISOString() } }
    );
    const deck = buildDailyDeck(onlyFirst, state.topics, { now, limit: 100, interleave: true, minTopics: 3 });
    expect(new Set(deck.map((d) => d.card.topicId)).size).toBe(3);
    expect(deck.filter((d) => d.bonus)).toHaveLength(2);

    const blocked = buildDailyDeck(onlyFirst, state.topics, { now, limit: 100, interleave: false, minTopics: 3 });
    expect(new Set(blocked.map((d) => d.card.topicId)).size).toBe(1);
  });
});

describe('seed data', () => {
  it('produces three topics, history, and some cards due today', () => {
    const now = new Date('2026-09-26T08:00:00');
    const s = createSeedState(now);
    expect(s.topics.map((t) => t.domain)).toEqual(['Philosophy', 'Systems Architecture', 'Physiology']);
    expect(s.reviews.length).toBeGreaterThan(18);
    expect(s.cards.some((c) => new Date(c.srs.due) <= now)).toBe(true);
  });
});
