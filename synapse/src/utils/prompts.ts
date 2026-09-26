import type { ID, SynthesisKind, Topic } from '../types';

/** Elaborative-interrogation and cross-disciplinary prompt generator. */

export interface Concept {
  topicId: ID;
  label: string;
  domain: string;
  tenet: string;
}

export interface GeneratedPrompt {
  kind: SynthesisKind;
  question: string;
  topicIds: ID[];
  concepts: Concept[];
}

export const KIND_META: Record<SynthesisKind, { label: string; blurb: string }> = {
  bridge: { label: 'Bridge', blurb: 'Connect two ideas from different fields' },
  failure: { label: 'Failure mode', blurb: 'Find where the model breaks' },
  counter: { label: 'Counter-argument', blurb: 'Steel-man the opposition' },
  mechanism: { label: 'Why it works', blurb: 'Trace the causal mechanism' },
  analogy: { label: 'Analogy', blurb: 'Explain in a foreign vocabulary' },
  transfer: { label: 'Transfer', blurb: 'Apply it in another domain' },
  prediction: { label: 'Prediction', blurb: 'Push it to the extreme' }
};

export const ALL_KINDS = Object.keys(KIND_META) as SynthesisKind[];

export type Rng = () => number;

export function seededRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

const pick = <T,>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length) % arr.length];

export function conceptsFrom(topics: Topic[]): Concept[] {
  return topics.flatMap((t) => [
    { topicId: t.id, label: t.title, domain: t.domain, tenet: t.coreTenet },
    ...t.mentalModels.map((m) => ({
      topicId: t.id,
      label: `${m.name} (from ${t.title})`,
      domain: t.domain,
      tenet: m.description
    }))
  ]);
}

function template(kind: SynthesisKind, a: Concept, b: Concept | null, rng: Rng): string {
  const B = b ?? a;
  const variants: Record<SynthesisKind, string[]> = {
    bridge: [
      `How does ${a.label} (${a.domain}) relate to ${B.label} (${B.domain})? Name one shared structure and one crucial difference.`,
      `What would an expert in ${B.domain} recognise instantly in ${a.label}? Where would their intuition mislead them?`,
      `If ${a.label} and ${B.label} are two instances of one deeper principle, what is that principle?`
    ],
    failure: [
      `In what scenario would ${a.label} fail or actively mislead you? Describe the boundary conditions.`,
      `Construct a concrete case where applying ${a.label} leads to the wrong decision. What signal would have warned you?`
    ],
    counter: [
      `What is the strongest counter-argument to this premise: “${a.tenet}”`,
      `A thoughtful critic rejects ${a.label}. What is their best argument, and what evidence would settle it?`
    ],
    mechanism: [
      `Why does ${a.label} work? Trace the causal mechanism step by step — no hand-waving.`,
      `What would have to be true about the world for ${a.label} to hold? Which assumption is weakest?`
    ],
    analogy: [
      `Explain ${a.label} using only the vocabulary of ${B.domain} (hint: think of ${B.label}).`,
      `Build an analogy between ${a.label} and something from everyday life. Where does the analogy break?`
    ],
    transfer: [
      `If you had to apply ${a.label} to a problem in ${B.domain}, what would it look like? Give one concrete example.`,
      `Which open problem in ${B.domain} could ${a.label} shed light on?`
    ],
    prediction: [
      `What would happen to ${B.label} if ${a.label} were pushed to its extreme?`,
      `Predict what someone who has never heard of ${a.label} would get wrong about ${B.domain}.`
    ]
  };
  return pick(variants[kind], rng);
}

const NEEDS_PARTNER: Record<SynthesisKind, boolean> = {
  bridge: true,
  failure: false,
  counter: false,
  mechanism: false,
  analogy: true,
  transfer: true,
  prediction: true
};

export interface GenerateOptions {
  kind?: SynthesisKind;
  anchorTopicId?: ID | null;
  rng?: Rng;
}

export function generatePrompt(topics: Topic[], opts: GenerateOptions = {}): GeneratedPrompt | null {
  if (topics.length === 0) return null;
  const rng = opts.rng ?? Math.random;
  const kind = opts.kind ?? pick(ALL_KINDS, rng);
  const concepts = conceptsFrom(topics);

  const anchorPool = opts.anchorTopicId ? concepts.filter((c) => c.topicId === opts.anchorTopicId) : concepts;
  const a = kind === 'counter' ? topLevel(anchorPool, rng) : pick(anchorPool.length ? anchorPool : concepts, rng);

  let b: Concept | null = null;
  if (NEEDS_PARTNER[kind]) {
    const anchorTopic = topics.find((t) => t.id === a.topicId);
    const linkedIds = new Set(anchorTopic?.links.map((l) => l.targetTopicId) ?? []);
    const otherTopics = concepts.filter((c) => c.topicId !== a.topicId);
    const otherDomain = otherTopics.filter((c) => c.domain !== a.domain);
    const unlinkedOtherDomain = otherDomain.filter((c) => !linkedIds.has(c.topicId));
    // Prefer surprising pairs (different domain, not already linked) most of the time.
    const pool =
      unlinkedOtherDomain.length && rng() < 0.7
        ? unlinkedOtherDomain
        : otherDomain.length
          ? otherDomain
          : otherTopics;
    b = pool.length ? pick(pool, rng) : null;
  }

  const question = template(kind, a, b, rng);
  const chosen = b ? [a, b] : [a];
  return { kind, question, topicIds: [...new Set(chosen.map((c) => c.topicId))], concepts: chosen };
}

function topLevel(pool: Concept[], rng: Rng): Concept {
  const tops = pool.filter((c) => !c.label.includes('(from '));
  return pick(tops.length ? tops : pool, rng);
}

/** Short elaborative-interrogation nudges shown after revealing a card. */
export function elaborationNudge(topic: Topic | undefined, rng: Rng = Math.random): string {
  const name = topic?.title ?? 'this';
  const other = topic?.mentalModels.length ? pick(topic.mentalModels, rng).name : null;
  const nudges = [
    `Why is this true — not just what is true?`,
    `How does this connect to ${other ?? 'something you already know well'}?`,
    `When would ${name} not apply?`,
    `What everyday example shows this in action?`,
    `What would change if the opposite were true?`
  ];
  return pick(nudges, rng);
}
