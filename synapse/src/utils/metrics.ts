import type { AppState, Card, ReviewLog } from '../types';
import { CONFIDENCE_PROB, retrievability } from './srs';
import { DAY, addDays, dayKey, startOfDay } from './date';

/** Every day key on which the learner did any deliberate practice. */
export function activeDays(state: AppState): Set<string> {
  const days = new Set<string>();
  for (const r of state.reviews) days.add(dayKey(r.reviewedAt));
  for (const b of state.blurts) days.add(dayKey(b.createdAt));
  for (const d of state.drafts) days.add(dayKey(d.updatedAt));
  for (const s of state.syntheses) days.add(dayKey(s.createdAt));
  return days;
}

export interface StreakInfo {
  current: number;
  longest: number;
  practicedToday: boolean;
}

export function streak(state: AppState, now = new Date()): StreakInfo {
  const days = activeDays(state);
  const practicedToday = days.has(dayKey(now));
  let current = 0;
  let cursor = practicedToday ? startOfDay(now) : addDays(startOfDay(now), -1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(`${k}T00:00:00`);
    run = prev && Math.round((d.getTime() - prev.getTime()) / DAY) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest: Math.max(longest, current), practicedToday };
}

function inWindow(r: ReviewLog, now: Date, days: number): boolean {
  return now.getTime() - new Date(r.reviewedAt).getTime() <= days * DAY;
}

export function accuracy(reviews: ReviewLog[], now = new Date(), windowDays = 30): number | null {
  const recent = reviews.filter((r) => inWindow(r, now, windowDays));
  if (!recent.length) return null;
  return recent.filter((r) => r.correct).length / recent.length;
}

/** Mean predicted recall probability across every reviewed card (0–1). */
export function retentionHealth(cards: Card[], now = new Date()): number | null {
  const values = cards
    .filter((c) => !c.suspended)
    .map((c) => retrievability(c.srs, now))
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface Calibration {
  /** Mean stated confidence as a probability. */
  confidence: number;
  /** Actual hit rate. */
  accuracy: number;
  /** confidence − accuracy. Positive = overconfident (illusion of competence). */
  gap: number;
  /** Brier score: lower is better, 0 is perfect. */
  brier: number;
  samples: number;
  /** Per-confidence-level hit rate for the calibration chart. */
  buckets: Array<{ level: 1 | 2 | 3 | 4; expected: number; actual: number | null; n: number }>;
}

export function calibration(reviews: ReviewLog[], now = new Date(), windowDays = 30): Calibration | null {
  const recent = reviews.filter((r) => inWindow(r, now, windowDays));
  if (!recent.length) return null;
  let conf = 0;
  let acc = 0;
  let brier = 0;
  for (const r of recent) {
    const p = CONFIDENCE_PROB[r.confidence];
    const o = r.correct ? 1 : 0;
    conf += p;
    acc += o;
    brier += (p - o) ** 2;
  }
  const n = recent.length;
  const buckets = ([1, 2, 3, 4] as const).map((level) => {
    const rs = recent.filter((r) => r.confidence === level);
    return {
      level,
      expected: CONFIDENCE_PROB[level],
      actual: rs.length ? rs.filter((r) => r.correct).length / rs.length : null,
      n: rs.length
    };
  });
  return { confidence: conf / n, accuracy: acc / n, gap: (conf - acc) / n, brier: brier / n, samples: n, buckets };
}

/** Count of cards due on each of the next `days` days; index 0 includes everything overdue. */
export function forecast(cards: Card[], now = new Date(), days = 7): Array<{ date: Date; count: number }> {
  const today = startOfDay(now);
  const out = Array.from({ length: days }, (_, i) => ({ date: addDays(today, i), count: 0 }));
  for (const c of cards) {
    if (c.suspended) continue;
    const due = new Date(c.srs.due);
    const idx = Math.floor((startOfDay(due).getTime() - today.getTime()) / DAY);
    if (idx <= 0) out[0].count++;
    else if (idx < days) out[idx].count++;
  }
  return out;
}

export interface DayActivity {
  key: string;
  date: Date;
  reviews: number;
  correct: number;
  other: number;
}

export function dailyActivity(state: AppState, now = new Date(), days = 28): DayActivity[] {
  const today = startOfDay(now);
  const map = new Map<string, DayActivity>();
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    map.set(dayKey(d), { key: dayKey(d), date: d, reviews: 0, correct: 0, other: 0 });
  }
  for (const r of state.reviews) {
    const a = map.get(dayKey(r.reviewedAt));
    if (a) {
      a.reviews++;
      if (r.correct) a.correct++;
    }
  }
  for (const x of [...state.blurts.map((b) => b.createdAt), ...state.syntheses.map((s) => s.createdAt)]) {
    const a = map.get(dayKey(x));
    if (a) a.other++;
  }
  for (const d of state.drafts) {
    const a = map.get(dayKey(d.updatedAt));
    if (a) a.other++;
  }
  return [...map.values()];
}

export function masteryByTopic(state: AppState, now = new Date()) {
  return state.topics.map((t) => {
    const cards = state.cards.filter((c) => c.topicId === t.id && !c.suspended);
    const r = retentionHealth(cards, now);
    const due = cards.filter((c) => new Date(c.srs.due).getTime() <= now.getTime()).length;
    const avgBox = cards.length ? cards.reduce((s, c) => s + c.srs.box, 0) / cards.length : 0;
    return { topic: t, cards: cards.length, due, retention: r, avgBox };
  });
}
