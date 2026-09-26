import type { Confidence, Grade, LeitnerBox, SRSState } from '../types';
import { DAY, MINUTE, addDays, startOfDay } from './date';

/**
 * Adapted SM-2 with Leitner boxes and confidence calibration.
 *
 * - Grades map to SM-2 quality: Again→1, Hard→3, Good→4, Easy→5.
 * - A lapse resets repetitions, drops the card to Leitner box 1 and re-shows it in 10 minutes.
 * - Metacognitive adjustments:
 *   · Confident-but-wrong (illusion of competence) costs extra ease, so the card returns more often.
 *   · Correct-but-unsure knowledge is fragile, so its interval growth is damped.
 */

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const MAX_INTERVAL = 365;
export const RELEARN_DELAY_MS = 10 * MINUTE;

const QUALITY: Record<Grade, number> = { 1: 1, 2: 3, 3: 4, 4: 5 };

export const GRADE_LABEL: Record<Grade, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  1: 'Guessing',
  2: 'Unsure',
  3: 'Fairly sure',
  4: 'Certain'
};
/** Subjective probability of being right implied by each confidence level. */
export const CONFIDENCE_PROB: Record<Confidence, number> = { 1: 0.25, 2: 0.5, 3: 0.75, 4: 0.95 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function newSRS(now = new Date()): SRSState {
  return {
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    lapses: 0,
    box: 1,
    due: now.toISOString(),
    lastReviewed: null
  };
}

export function schedule(prev: SRSState, grade: Grade, confidence: Confidence, now = new Date()): SRSState {
  let { ease, interval, repetitions, lapses } = prev;
  let box: LeitnerBox = prev.box;
  const q = QUALITY[grade];

  if (grade === 1) {
    repetitions = 0;
    lapses += 1;
    interval = 0;
    box = 1;
    ease -= 0.2;
    if (confidence >= 3) ease -= 0.05 * (confidence - 2);
    ease = clamp(ease, MIN_EASE, MAX_EASE);
    return {
      ease: round2(ease),
      interval,
      repetitions,
      lapses,
      box,
      due: new Date(now.getTime() + RELEARN_DELAY_MS).toISOString(),
      lastReviewed: now.toISOString()
    };
  }

  repetitions += 1;
  if (repetitions === 1) {
    interval = grade === 4 ? 3 : 1;
  } else if (repetitions === 2) {
    interval = grade === 2 ? 3 : grade === 4 ? 8 : 6;
  } else {
    const modifier = grade === 2 ? 0.8 : grade === 4 ? 1.3 : 1;
    interval = Math.max(interval + 1, Math.round(interval * ease * modifier));
  }

  if (confidence <= 2) {
    interval = Math.max(1, Math.round(interval * 0.85));
  }

  ease = clamp(ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), MIN_EASE, MAX_EASE);
  interval = Math.min(interval, MAX_INTERVAL);
  box = Math.min(5, box + 1) as LeitnerBox;

  return {
    ease: round2(ease),
    interval,
    repetitions,
    lapses,
    box,
    due: addDays(startOfDay(now), interval).toISOString(),
    lastReviewed: now.toISOString()
  };
}

/** Next interval (days) for every grade, used for the button hints. */
export function previewIntervals(srs: SRSState, confidence: Confidence, now = new Date()): Record<Grade, number> {
  return {
    1: schedule(srs, 1, confidence, now).interval,
    2: schedule(srs, 2, confidence, now).interval,
    3: schedule(srs, 3, confidence, now).interval,
    4: schedule(srs, 4, confidence, now).interval
  };
}

export function isDue(srs: SRSState, now = new Date()): boolean {
  return new Date(srs.due).getTime() <= now.getTime();
}

/**
 * Estimated probability of recall using an exponential forgetting curve calibrated so
 * that retrievability is 90% on the due date. Returns null for never-reviewed cards.
 */
export function retrievability(srs: SRSState, now = new Date()): number | null {
  if (!srs.lastReviewed) return null;
  const stability = Math.max(srs.interval, 0.5);
  const elapsed = Math.max(0, (now.getTime() - new Date(srs.lastReviewed).getTime()) / DAY);
  return Math.exp((Math.log(0.9) * elapsed) / stability);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
