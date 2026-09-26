import type { RecallLevel, Topic } from '../types';

/** Lightweight key-term extraction and recall comparison for Blurting's Reveal & Diff view. */

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below
between both but by can cannot could did do does doing down during each either else enough even ever every
few for from further get gets got had has have having he her here hers him his how however i if in into is it
its itself just less let like likely made make makes many may me might more most much must my neither no nor not
now of off often on once one only or other others our out over own per perhaps rather same seem seems she should
since so some something such than that the their them then there these they thing things this those though
through thus to too under until up upon us use used uses using very via was way ways we well were what when where
whether which while who whom whose why will with within without would yet you your yours itself themselves
become becomes called example instance means mean really simply basically usually another first second new
across along among around onto toward towards back given take takes taken says said`
    .split(/\s+/)
    .filter(Boolean)
);

export function stem(word: string): string {
  let w = word.toLowerCase().replace(/['’]s$/, '').replace(/[’']/g, '');
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ied')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('ly') && !w.endsWith('ply')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? [])
    .flatMap((t) => t.split('-'))
    .map((t) => t.replace(/['’]s$/, '').replace(/['’]/g, ''))
    .filter(Boolean);
}

export interface KeyTerm {
  /** Display form (most common surface form). */
  term: string;
  stem: string;
  weight: number;
}

export function extractKeyTerms(text: string, max = 24): KeyTerm[] {
  const counts = new Map<string, { weight: number; forms: Map<string, number> }>();
  for (const tok of tokenize(text)) {
    if (tok.length < 4 || STOPWORDS.has(tok)) continue;
    const s = stem(tok);
    const entry = counts.get(s) ?? { weight: 0, forms: new Map() };
    entry.weight += 1 + Math.min(tok.length, 12) / 12;
    entry.forms.set(tok, (entry.forms.get(tok) ?? 0) + 1);
    counts.set(s, entry);
  }
  return [...counts.entries()]
    .map(([s, e]) => ({
      stem: s,
      weight: e.weight,
      term: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }))
    .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
    .slice(0, max);
}

export function masterText(topic: Topic): string {
  const models = topic.mentalModels.map((m) => `${m.name}: ${m.description}`).join('\n');
  return [topic.coreTenet, topic.sourceSummary, models].filter(Boolean).join('\n\n');
}

export interface RecallComparison {
  recalled: KeyTerm[];
  missed: KeyTerm[];
  coverage: number;
  suggested: RecallLevel;
}

export function compareRecall(master: string, dump: string, max = 24): RecallComparison {
  const terms = extractKeyTerms(master, max);
  const dumpStems = new Set(tokenize(dump).map(stem));
  const recalled: KeyTerm[] = [];
  const missed: KeyTerm[] = [];
  for (const t of terms) (dumpStems.has(t.stem) ? recalled : missed).push(t);
  const total = terms.reduce((s, t) => s + t.weight, 0);
  const got = recalled.reduce((s, t) => s + t.weight, 0);
  const coverage = total === 0 ? 0 : got / total;
  return { recalled, missed, coverage, suggested: suggestRecall(coverage) };
}

export function suggestRecall(coverage: number): RecallLevel {
  if (coverage >= 0.6) return 'high';
  if (coverage >= 0.3) return 'medium';
  return 'low';
}

/** Splits master text into segments marking recalled / missed key terms for the diff view. */
export function markTerms(
  text: string,
  recalled: KeyTerm[],
  missed: KeyTerm[]
): Array<{ text: string; state: 'recalled' | 'missed' | null }> {
  const recalledStems = new Set(recalled.map((t) => t.stem));
  const missedStems = new Set(missed.map((t) => t.stem));
  const out: Array<{ text: string; state: 'recalled' | 'missed' | null }> = [];
  const re = /[A-Za-z][A-Za-z'’]*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const s = stem(m[0]);
    const state = recalledStems.has(s) ? 'recalled' : missedStems.has(s) ? 'missed' : null;
    if (!state) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index), state: null });
    out.push({ text: m[0], state });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), state: null });
  return out;
}
