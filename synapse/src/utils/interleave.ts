import type { Card, Topic } from '../types';

export interface DeckItem {
  card: Card;
  /** True when the card was pulled in early to reach the interleave topic minimum. */
  bonus: boolean;
}

export interface DeckOptions {
  now: Date;
  limit: number;
  interleave: boolean;
  minTopics: number;
}

/**
 * Builds today's deck: due cards sorted by urgency, capped at `limit`.
 * In Interleave Mode, the deck is guaranteed to span `minTopics` topics when possible (pulling in the
 * soonest-due cards from other topics) and is ordered so consecutive prompts come from different
 * topics — and ideally different domains.
 */
export function buildDailyDeck(cards: Card[], topics: Topic[], opts: DeckOptions): DeckItem[] {
  const topicIds = new Set(topics.map((t) => t.id));
  const active = cards.filter((c) => !c.suspended && topicIds.has(c.topicId));
  const nowMs = opts.now.getTime();
  const byDue = (a: Card, b: Card) => new Date(a.srs.due).getTime() - new Date(b.srs.due).getTime();

  const due = active.filter((c) => new Date(c.srs.due).getTime() <= nowMs).sort(byDue).slice(0, opts.limit);
  const items: DeckItem[] = due.map((card) => ({ card, bonus: false }));

  if (!opts.interleave) return items;

  const covered = new Set(items.map((i) => i.card.topicId));
  if (covered.size < opts.minTopics) {
    const upcoming = active
      .filter((c) => new Date(c.srs.due).getTime() > nowMs && !covered.has(c.topicId))
      .sort(byDue);
    for (const c of upcoming) {
      if (covered.size >= opts.minTopics) break;
      if (covered.has(c.topicId)) continue;
      covered.add(c.topicId);
      items.push({ card: c, bonus: true });
    }
  }

  const domainOf = new Map(topics.map((t) => [t.id, t.domain]));
  return interleaveOrder(items, (i) => i.card.topicId, (i) => domainOf.get(i.card.topicId) ?? '');
}

/**
 * Greedy round-robin: always pick from the largest remaining group whose topic differs from the
 * previous item (and whose domain differs, when such a group exists). Stable within groups.
 */
export function interleaveOrder<T>(items: T[], topicOf: (t: T) => string, domainOf: (t: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = topicOf(it);
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }
  const out: T[] = [];
  let lastTopic: string | null = null;
  let lastDomain: string | null = null;
  while (out.length < items.length) {
    const candidates = [...groups.entries()].filter(([, g]) => g.length > 0);
    const differentTopic = candidates.filter(([k]) => k !== lastTopic);
    const pool = differentTopic.length ? differentTopic : candidates;
    const differentDomain = pool.filter(([, g]) => domainOf(g[0]) !== lastDomain);
    const finalPool = differentDomain.length ? differentDomain : pool;
    finalPool.sort((a, b) => b[1].length - a[1].length);
    const [key, group] = finalPool[0];
    const next = group.shift() as T;
    out.push(next);
    lastTopic = key;
    lastDomain = domainOf(next);
  }
  return out;
}

/** Counts how many adjacent pairs switch topic — a simple measure of interleaving quality. */
export function switchRate<T>(items: T[], topicOf: (t: T) => string): number {
  if (items.length < 2) return 0;
  let switches = 0;
  for (let i = 1; i < items.length; i++) if (topicOf(items[i]) !== topicOf(items[i - 1])) switches++;
  return switches / (items.length - 1);
}
