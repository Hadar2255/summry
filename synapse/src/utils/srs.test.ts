import { describe, expect, it } from 'vitest';
import { MIN_EASE, newSRS, previewIntervals, retrievability, schedule } from './srs';

const NOW = new Date('2026-09-26T10:00:00');

describe('schedule (adapted SM-2)', () => {
  it('grows intervals on successive Good answers and advances the Leitner box', () => {
    let s = newSRS(NOW);
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = schedule(s, 3, 3, NOW);
      intervals.push(s.interval);
    }
    expect(intervals[0]).toBe(1);
    expect(intervals[1]).toBe(6);
    expect(intervals[2]).toBeGreaterThan(intervals[1]);
    expect(intervals[3]).toBeGreaterThan(intervals[2]);
    expect(s.box).toBe(5);
  });

  it('resets on a lapse, drops to box 1 and re-shows within the session', () => {
    let s = schedule(schedule(newSRS(NOW), 3, 3, NOW), 3, 3, NOW);
    s = schedule(s, 1, 2, NOW);
    expect(s.interval).toBe(0);
    expect(s.repetitions).toBe(0);
    expect(s.box).toBe(1);
    expect(s.lapses).toBe(1);
    expect(new Date(s.due).getTime() - NOW.getTime()).toBe(10 * 60_000);
  });

  it('penalises confident misses (illusion of competence) more than unsure misses', () => {
    const base = schedule(newSRS(NOW), 3, 3, NOW);
    const confidentMiss = schedule(base, 1, 4, NOW);
    const unsureMiss = schedule(base, 1, 1, NOW);
    expect(confidentMiss.ease).toBeLessThan(unsureMiss.ease);
    expect(confidentMiss.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });

  it('damps interval growth for correct-but-unsure answers', () => {
    let s = newSRS(NOW);
    s = schedule(s, 3, 3, NOW);
    s = schedule(s, 3, 3, NOW);
    const sure = schedule(s, 3, 4, NOW);
    const unsure = schedule(s, 3, 1, NOW);
    expect(unsure.interval).toBeLessThan(sure.interval);
  });

  it('orders previews Again < Hard <= Good < Easy', () => {
    const s = schedule(schedule(newSRS(NOW), 3, 3, NOW), 3, 3, NOW);
    const p = previewIntervals(s, 3, NOW);
    expect(p[1]).toBe(0);
    expect(p[2]).toBeLessThanOrEqual(p[3]);
    expect(p[3]).toBeLessThan(p[4]);
  });
});

describe('retrievability', () => {
  it('is null for unseen cards and ~90% on the due date', () => {
    expect(retrievability(newSRS(NOW), NOW)).toBeNull();
    const s = { ...newSRS(NOW), interval: 10, lastReviewed: NOW.toISOString() };
    const due = new Date(NOW.getTime() + 10 * 86_400_000);
    expect(retrievability(s, due)).toBeCloseTo(0.9, 5);
    expect(retrievability(s, NOW)).toBeCloseTo(1, 5);
  });
});
