/**
 * Jargon & Complexity Scanner for the Feynman Studio.
 * Flags long sentences, jargon/buzzwords, undefined acronyms, hand-waving words and
 * multi-syllable vocabulary, then scores how close the text is to "explain it to a 10-year-old".
 */

export type IssueKind = 'long-sentence' | 'jargon' | 'acronym' | 'hand-wave' | 'complex-word';
export type Severity = 'info' | 'warn' | 'high';

export interface ScanIssue {
  kind: IssueKind;
  start: number;
  end: number;
  text: string;
  message: string;
  suggestion?: string;
  severity: Severity;
}

export interface ScanResult {
  issues: ScanIssue[];
  words: number;
  sentences: number;
  avgSentenceLength: number;
  readingGrade: number;
  complexWordRatio: number;
  clarityScore: number;
  verdict: string;
}

export const LONG_SENTENCE = 20;
export const VERY_LONG_SENTENCE = 30;
const TARGET_GRADE = 6;

/** Jargon → plain-language alternative ('' when no single-word swap exists). */
export const JARGON: Record<string, string> = {
  utilize: 'use',
  utilise: 'use',
  leverage: 'use',
  facilitate: 'help',
  optimize: 'improve',
  optimise: 'improve',
  paradigm: 'way of thinking',
  'paradigm shift': 'big change in thinking',
  methodology: 'method',
  synergy: 'working together',
  holistic: 'whole-picture',
  robust: 'sturdy',
  scalable: 'able to grow',
  ecosystem: 'surroundings',
  orthogonal: 'unrelated',
  heuristic: 'rule of thumb',
  substrate: 'base layer',
  instantiate: 'create',
  dichotomy: 'split',
  salient: 'important',
  ubiquitous: 'everywhere',
  commence: 'start',
  subsequently: 'later',
  approximately: 'about',
  demonstrate: 'show',
  sufficient: 'enough',
  numerous: 'many',
  functionality: 'feature',
  epistemic: 'about knowing',
  ontological: 'about what exists',
  parsimonious: 'simplest',
  parsimony: 'simplicity',
  emergent: 'arising from the parts',
  homeostasis: 'balance',
  modality: 'kind',
  juxtapose: 'compare',
  nuanced: 'subtle',
  idempotent: 'safe to repeat',
  asynchronous: 'not at the same time',
  throughput: 'amount handled per second',
  latency: 'delay',
  invariant: 'rule that never changes',
  abstraction: 'simplified view',
  granular: 'detailed',
  'best practice': 'good habit',
  'at the end of the day': '',
  'in terms of': 'about',
  'going forward': 'from now on',
  'deep dive': 'close look',
  'low-hanging fruit': 'easy win',
  'value add': 'benefit',
  bandwidth: 'time or energy',
  actionable: 'useful',
  operationalize: 'put into practice',
  conceptualize: 'imagine',
  aforementioned: 'this',
  henceforth: 'from now on',
  notwithstanding: 'despite',
  wherein: 'where',
  thereby: 'so',
  'a priori': 'beforehand',
  'ad hoc': 'improvised'
};

const HAND_WAVES = [
  'basically',
  'essentially',
  'obviously',
  'clearly',
  'simply',
  'somehow',
  'sort of',
  'kind of',
  'etc',
  'and so on',
  'stuff like that',
  'magically',
  'it just works',
  'of course'
];

const ACRONYM_WHITELIST = new Set(['I', 'OK', 'TV', 'A', 'AM', 'PM', 'US', 'UK', 'USA', 'EU', 'ID']);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

interface Span {
  start: number;
  end: number;
  text: string;
}

export function splitSentences(text: string): Span[] {
  const out: Span[] = [];
  const re = /[^.!?\n]+(?:[.!?]+|$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed && /[A-Za-z0-9]/.test(trimmed)) {
      out.push({ start: m.index + lead, end: m.index + lead + trimmed.length, text: trimmed });
    }
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

export function words(text: string): Span[] {
  const out: Span[] = [];
  const re = /[A-Za-z][A-Za-z'’-]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  return out;
}

function isAcronymDefined(text: string, acronym: string): boolean {
  const a = escapeRe(acronym.replace(/s$/, ''));
  return (
    new RegExp(`\\(\\s*${a}s?\\s*\\)`).test(text) ||
    new RegExp(`\\b${a}s?\\s*\\(`).test(text) ||
    new RegExp(`\\b${a}s?\\s+(?:means|stands for|is short for|is an abbreviation)`, 'i').test(text)
  );
}

export function scanText(text: string): ScanResult {
  const issues: ScanIssue[] = [];
  const sentenceSpans = splitSentences(text);
  const wordSpans = words(text);
  const lower = text.toLowerCase();

  for (const s of sentenceSpans) {
    const n = words(s.text).length;
    if (n > LONG_SENTENCE) {
      const high = n > VERY_LONG_SENTENCE;
      issues.push({
        kind: 'long-sentence',
        start: s.start,
        end: s.end,
        text: s.text,
        severity: high ? 'high' : 'warn',
        message: `${n}-word sentence. Split it — a 10-year-old loses the thread after ~${LONG_SENTENCE} words.`
      });
    }
  }

  const jargonTerms = Object.keys(JARGON).sort((a, b) => b.length - a.length);
  const taken: Array<[number, number]> = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);

  for (const term of jargonTerms) {
    const re = new RegExp(`\\b${escapeRe(term)}(?:s|es|d|ed|ing|ation|ations)?\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      taken.push([start, end]);
      const alt = JARGON[term];
      issues.push({
        kind: 'jargon',
        start,
        end,
        text: m[0],
        severity: 'warn',
        message: alt ? `Jargon. Try “${alt}”.` : 'Filler phrase — cut it.',
        suggestion: alt || undefined
      });
    }
  }

  for (const hw of HAND_WAVES) {
    const re = new RegExp(`\\b${escapeRe(hw)}\\b`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      taken.push([start, end]);
      issues.push({
        kind: 'hand-wave',
        start,
        end,
        text: text.slice(start, end),
        severity: 'info',
        message: 'Hand-waving word. It often papers over a gap — can you say exactly what happens here?'
      });
    }
  }

  const acronymRe = /\b[A-Z][A-Z0-9]{1,}s?\b/g;
  const flaggedAcronyms = new Set<string>();
  let am: RegExpExecArray | null;
  while ((am = acronymRe.exec(text))) {
    const acr = am[0];
    const base = acr.replace(/s$/, '');
    if (ACRONYM_WHITELIST.has(base) || /^\d+$/.test(base)) continue;
    if (isAcronymDefined(text, acr)) continue;
    const start = am.index;
    const end = start + acr.length;
    if (overlaps(start, end)) continue;
    taken.push([start, end]);
    const first = !flaggedAcronyms.has(base);
    flaggedAcronyms.add(base);
    issues.push({
      kind: 'acronym',
      start,
      end,
      text: acr,
      severity: first ? 'high' : 'warn',
      message: `Undefined acronym “${base}”. Spell it out, e.g. “Full Name (${base})”, or drop it.`
    });
  }

  let syllables = 0;
  let complex = 0;
  for (const w of wordSpans) {
    const syl = countSyllables(w.text);
    syllables += syl;
    const isProperNoun = /^[A-Z]/.test(w.text) && w.start > 0 && !/[.!?]\s*$/.test(text.slice(0, w.start));
    if (syl >= 4 && !isProperNoun) {
      complex += 1;
      if (!overlaps(w.start, w.end)) {
        issues.push({
          kind: 'complex-word',
          start: w.start,
          end: w.end,
          text: w.text,
          severity: 'info',
          message: `${syl}-syllable word. Is there a shorter, everyday word?`
        });
      }
    }
  }

  const wordCount = wordSpans.length;
  const sentenceCount = Math.max(1, sentenceSpans.length);
  const avgSentenceLength = wordCount / sentenceCount;
  const readingGrade =
    wordCount === 0 ? 0 : Math.max(0, 0.39 * avgSentenceLength + 11.8 * (syllables / wordCount) - 15.59);
  const complexWordRatio = wordCount === 0 ? 0 : complex / wordCount;

  let score = 100;
  for (const i of issues) {
    if (i.kind === 'long-sentence') score -= i.severity === 'high' ? 14 : 8;
    else if (i.kind === 'jargon') score -= 6;
    else if (i.kind === 'acronym') score -= i.severity === 'high' ? 10 : 3;
    else if (i.kind === 'hand-wave') score -= 3;
  }
  if (complexWordRatio > 0.1) score -= (complexWordRatio - 0.1) * 150;
  if (readingGrade > TARGET_GRADE) score -= (readingGrade - TARGET_GRADE) * 4;
  const clarityScore = wordCount === 0 ? 0 : Math.round(Math.min(100, Math.max(0, score)));

  issues.sort((a, b) => a.start - b.start || b.end - a.end);

  return {
    issues,
    words: wordCount,
    sentences: sentenceSpans.length,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    readingGrade: Math.round(readingGrade * 10) / 10,
    complexWordRatio,
    clarityScore,
    verdict: verdictFor(clarityScore, wordCount)
  };
}

function verdictFor(score: number, wordCount: number): string {
  if (wordCount === 0) return 'Start explaining — pretend a curious 10-year-old is sitting next to you.';
  if (wordCount < 25) return 'Keep going. A real explanation needs a few sentences and at least one example.';
  if (score >= 85) return 'Crystal clear. A 10-year-old could follow this.';
  if (score >= 70) return 'Mostly plain language. Polish the flagged spots.';
  if (score >= 50) return 'Getting technical. Replace jargon with everyday words and examples.';
  return 'This reads like a textbook. Rebuild it from first principles with an analogy.';
}

export interface HighlightSegment {
  text: string;
  kinds: IssueKind[];
  messages: string[];
}

/** Splits text into segments annotated with every issue kind covering them. */
export function segmentText(text: string, issues: ScanIssue[]): HighlightSegment[] {
  if (!text) return [];
  const bounds = new Set<number>([0, text.length]);
  for (const i of issues) {
    bounds.add(i.start);
    bounds.add(i.end);
  }
  const points = [...bounds].sort((a, b) => a - b);
  const out: HighlightSegment[] = [];
  for (let k = 0; k < points.length - 1; k++) {
    const s = points[k];
    const e = points[k + 1];
    if (s === e) continue;
    const covering = issues.filter((i) => i.start <= s && i.end >= e);
    out.push({
      text: text.slice(s, e),
      kinds: [...new Set(covering.map((c) => c.kind))],
      messages: covering.map((c) => c.message)
    });
  }
  return out;
}
