import { describe, expect, it } from 'vitest';
import { compareRecall, extractKeyTerms, markTerms, stem } from './recall';

const MASTER =
  'Backpressure pushes a slow-down signal upstream. Bounded queues make overload visible. ' +
  'Little’s Law links queue length, arrival rate and latency. Load shedding drops work under overload.';

describe('recall comparison', () => {
  it('stems plural and verb forms together', () => {
    expect(stem('queues')).toBe(stem('queue'));
    expect(stem('pushes')).toBe(stem('push'));
    expect(stem('multiplies')).toBe(stem('multiplied'));
    expect(stem('multiplied')).toBe(stem('multiply'));
    expect(stem('Hickam’s')).toBe(stem('hickam'));
  });

  it('extracts content words, not stopwords', () => {
    const terms = extractKeyTerms(MASTER).map((t) => t.term);
    expect(terms).toContain('overload');
    expect(terms).not.toContain('the');
  });

  it('computes higher coverage for a better dump', () => {
    const weak = compareRecall(MASTER, 'something about signals');
    const strong = compareRecall(MASTER, 'Backpressure: bounded queue makes overload visible; Little law links queue length, arrival rate, latency; load shedding drops work.');
    expect(strong.coverage).toBeGreaterThan(weak.coverage);
    expect(strong.suggested).toBe('high');
    expect(weak.suggested).toBe('low');
  });

  it('marks terms without losing text', () => {
    const cmp = compareRecall(MASTER, 'overload queue');
    const segs = markTerms(MASTER, cmp.recalled, cmp.missed);
    expect(segs.map((s) => s.text).join('')).toBe(MASTER);
    expect(segs.some((s) => s.state === 'recalled')).toBe(true);
    expect(segs.some((s) => s.state === 'missed')).toBe(true);
  });
});
