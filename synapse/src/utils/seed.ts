import type {
  AppState,
  BlurtSession,
  Card,
  Confidence,
  FeynmanDraft,
  Grade,
  ReviewLog,
  SynthesisEntry,
  Topic
} from '../types';
import { SCHEMA_VERSION } from '../types';
import { DEFAULT_SETTINGS } from './storage';
import { newSRS, schedule } from './srs';
import { addDays, startOfDay } from './date';
import { seededRng } from './prompts';
import { compareRecall, masterText } from './recall';
import { scanText } from './jargon';

/**
 * Demo content: three deliberately unrelated subjects so Interleave Mode has something to mix,
 * plus ~9 days of simulated review history so every dashboard metric is populated on first launch.
 */

const T_OCCAM = 'topic-occams-razor';
const T_BACKPRESSURE = 'topic-backpressure';
const T_NEURO = 'topic-neuroplasticity';

function topics(nowIso: string): Topic[] {
  return [
    {
      id: T_OCCAM,
      title: "Occam's Razor",
      domain: 'Philosophy',
      coreTenet:
        'Among explanations that fit the evidence equally well, prefer the one that makes the fewest assumptions.',
      sourceSummary:
        'Attributed to the 14th-century friar William of Ockham ("entities should not be multiplied beyond necessity"). ' +
        'The razor is a heuristic, not a law of nature: it does not say the simplest explanation is true, only that ' +
        'extra assumptions each carry a risk of being wrong, so they must earn their place by explaining more evidence. ' +
        'In probability terms, a hypothesis that needs many independent assumptions has a lower prior, because the ' +
        'probabilities multiply. In science and machine learning it appears as a preference for models that generalize ' +
        'rather than overfit. Its classic counterweight is Hickam’s dictum from medicine: a patient can have as many ' +
        'diseases as they please — reality is not obliged to be simple.',
      source: 'Stanford Encyclopedia of Philosophy — "Simplicity"',
      mentalModels: [
        {
          id: 'mm-occam-1',
          name: 'Assumptions multiply risk',
          description: 'Each independent assumption has some chance of being false; stacking them shrinks the joint probability.'
        },
        {
          id: 'mm-occam-2',
          name: 'Overfitting',
          description: 'A model with too many free parameters explains noise in the data and fails on new cases.'
        },
        {
          id: 'mm-occam-3',
          name: "Hickam's dictum",
          description: 'The counter-principle: complex systems often do have multiple simultaneous causes.'
        }
      ],
      tags: ['epistemology', 'heuristics', 'reasoning'],
      links: [
        { id: 'link-1', targetTopicId: T_NEURO, relation: 'Synaptic pruning is the brain’s own razor' },
        { id: 'link-2', targetTopicId: T_BACKPRESSURE, relation: 'Prefer the simplest flow-control mechanism that works' }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: T_BACKPRESSURE,
      title: 'Backpressure',
      domain: 'Systems Architecture',
      coreTenet:
        'When a consumer cannot keep up with a producer, the system should push a "slow down" signal upstream instead of buffering without limit.',
      sourceSummary:
        'In any pipeline, work arrives at some rate and is processed at another. If arrivals outpace processing, the ' +
        'difference accumulates in queues. Unbounded queues hide the problem until memory runs out or latency explodes. ' +
        'Backpressure makes overload visible: bounded buffers fill, the consumer signals demand, and producers block, ' +
        'slow down, or shed load. TCP flow control uses a receive window; Reactive Streams uses explicit request(n) demand. ' +
        'Little’s Law (L = λW) links queue length, arrival rate and waiting time, so a growing queue always means growing ' +
        'latency. The three honest options under overload are: buffer (bounded), drop (load shedding), or control the producer.',
      source: 'Designing Data-Intensive Applications, ch. 11; reactive-streams.org',
      mentalModels: [
        {
          id: 'mm-bp-1',
          name: "Little's Law",
          description: 'Average items in a system = arrival rate × average time in system (L = λW).'
        },
        {
          id: 'mm-bp-2',
          name: 'Bounded queues',
          description: 'A buffer with a hard limit turns hidden overload into an explicit signal.'
        },
        {
          id: 'mm-bp-3',
          name: 'Load shedding',
          description: 'Deliberately dropping low-priority work to protect the latency of the rest.'
        },
        {
          id: 'mm-bp-4',
          name: 'Demand signalling',
          description: 'The consumer tells the producer how much it can take (TCP window, request(n)).'
        }
      ],
      tags: ['distributed-systems', 'flow-control', 'queues'],
      links: [
        { id: 'link-3', targetTopicId: T_NEURO, relation: 'Homeostatic plasticity is biological backpressure' }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: T_NEURO,
      title: 'Neuroplasticity',
      domain: 'Physiology',
      coreTenet:
        'The nervous system physically rewires itself in response to experience: connections that are used together strengthen, unused ones weaken.',
      sourceSummary:
        'Plasticity operates at several levels. Synaptic plasticity changes the strength of individual connections: ' +
        'long-term potentiation (LTP) strengthens a synapse after repeated, correlated firing, while long-term depression ' +
        'weakens it. Structural plasticity grows or removes dendritic spines and whole synapses. Myelination speeds up ' +
        'frequently used pathways. Homeostatic plasticity scales overall excitability up or down so networks stay stable. ' +
        'Plasticity is strongest in critical periods of childhood but persists through adulthood. Effortful retrieval, ' +
        'spacing and sleep all support consolidation — which is why active recall beats rereading.',
      source: 'Kandel et al., Principles of Neural Science, ch. 67',
      mentalModels: [
        {
          id: 'mm-np-1',
          name: 'Hebbian learning',
          description: '"Cells that fire together wire together": correlated activity strengthens a connection.'
        },
        {
          id: 'mm-np-2',
          name: 'Synaptic pruning',
          description: 'Unused synapses are eliminated, sharpening the circuits that remain.'
        },
        {
          id: 'mm-np-3',
          name: 'Desirable difficulty',
          description: 'Effortful retrieval produces stronger, longer-lasting memory traces than easy review.'
        }
      ],
      tags: ['neuroscience', 'learning', 'memory'],
      links: [
        { id: 'link-4', targetTopicId: T_OCCAM, relation: 'Pruning favours the simplest circuit that does the job' }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];
}

const CARD_TEXT: Array<[string, string, string]> = [
  [T_OCCAM, "State Occam's Razor precisely.", 'Among explanations that fit the evidence equally well, prefer the one with the fewest assumptions.'],
  [T_OCCAM, 'Does Occam’s Razor claim the simplest explanation is true?', 'No. It is a heuristic for choosing what to test first — extra assumptions must earn their place by explaining more.'],
  [T_OCCAM, 'Why does each extra assumption lower a hypothesis’s probability?', 'Independent probabilities multiply: 0.9 × 0.9 × 0.9 is already 0.73.'],
  [T_OCCAM, 'What is Hickam’s dictum and why does it matter?', '“A patient can have as many diseases as they please.” It warns that real systems can have several causes at once.'],
  [T_OCCAM, 'How does overfitting relate to Occam’s Razor?', 'An overly complex model fits noise; preferring simpler models improves generalisation to new data.'],
  [T_OCCAM, 'Who is the razor named after, and what is the original phrasing?', 'William of Ockham — “entities should not be multiplied beyond necessity.”'],
  [T_BACKPRESSURE, 'Define backpressure in one sentence.', 'A signal flowing upstream that tells producers to slow down when consumers can’t keep up.'],
  [T_BACKPRESSURE, 'Why are unbounded queues dangerous?', 'They hide overload until memory is exhausted or latency explodes — failure arrives late and all at once.'],
  [T_BACKPRESSURE, 'State Little’s Law and one consequence.', 'L = λW. With a fixed service rate, a growing queue means growing waiting time.'],
  [T_BACKPRESSURE, 'Name the three honest responses to overload.', 'Buffer (bounded), drop (load shedding), or control the producer (backpressure).'],
  [T_BACKPRESSURE, 'How does TCP implement backpressure?', 'The receiver advertises a receive window; the sender may not have more unacknowledged bytes in flight than that.'],
  [T_BACKPRESSURE, 'What does request(n) do in Reactive Streams?', 'The subscriber signals it can accept n more items; the publisher must never emit more than requested.'],
  [T_NEURO, 'What is neuroplasticity?', 'The nervous system’s ability to physically rewire itself — strengthening, weakening, adding or removing connections — in response to experience.'],
  [T_NEURO, 'What is long-term potentiation (LTP)?', 'A lasting increase in synaptic strength after repeated, correlated activation of the pre- and post-synaptic neuron.'],
  [T_NEURO, 'Explain Hebbian learning in plain words.', 'Neurons that fire together wire together: if one repeatedly helps fire another, their connection gets stronger.'],
  [T_NEURO, 'What is homeostatic plasticity for?', 'It scales overall excitability up or down so strengthening synapses doesn’t push the network into runaway activity.'],
  [T_NEURO, 'Why does active recall beat rereading, neurologically?', 'Effortful retrieval re-activates and strengthens the memory pathway (a desirable difficulty); rereading only builds familiarity.'],
  [T_NEURO, 'What does synaptic pruning do?', 'Removes weak or unused synapses, making the remaining circuits more efficient.']
];

function pickGrade(rng: () => number): Grade {
  const r = rng();
  if (r < 0.13) return 1;
  if (r < 0.3) return 2;
  if (r < 0.85) return 3;
  return 4;
}

function pickConfidence(grade: Grade, rng: () => number): Confidence {
  const base = grade === 1 ? 2 : grade === 2 ? 2 : grade === 3 ? 3 : 4;
  const noise = rng() < 0.25 ? (rng() < 0.5 ? -1 : 1) : 0;
  return Math.min(4, Math.max(1, base + noise)) as Confidence;
}

export function createSeedState(now = new Date()): AppState {
  const rng = seededRng(20260926);
  const nowIso = now.toISOString();
  const today = startOfDay(now);
  const reviews: ReviewLog[] = [];
  const createdAt = addDays(today, -10).toISOString();
  const seededTopics = topics(createdAt);

  const cards: Card[] = CARD_TEXT.map(([topicId, prompt, answer], i) => {
    const id = `card-seed-${i + 1}`;
    // Stagger first reviews across the last 9 days so there is a continuous streak ending yesterday.
    const firstOffset = -9 + (i % 9);
    let when = new Date(addDays(today, firstOffset).getTime() + (9 + Math.floor(rng() * 11)) * 3_600_000);
    let srs = newSRS(new Date(createdAt));
    while (when.getTime() < today.getTime()) {
      const grade = pickGrade(rng);
      const confidence = pickConfidence(grade, rng);
      const next = schedule(srs, grade, confidence, when);
      reviews.push({
        id: `rev-seed-${reviews.length + 1}`,
        cardId: id,
        topicId,
        reviewedAt: when.toISOString(),
        confidence,
        grade,
        correct: grade >= 2,
        responseMs: 3000 + Math.floor(rng() * 9000),
        interleaved: true,
        previousInterval: srs.interval,
        nextInterval: next.interval
      });
      srs = next;
      const due = new Date(srs.due);
      // A lapse is re-studied the next day in this simulation.
      when =
        grade === 1
          ? new Date(addDays(startOfDay(when), 1).getTime() + (9 + Math.floor(rng() * 11)) * 3_600_000)
          : new Date(due.getTime() + (9 + Math.floor(rng() * 11)) * 3_600_000);
    }
    return { id, topicId, prompt, answer, origin: 'seed', suspended: false, srs, createdAt };
  });

  const occam = seededTopics[0];
  const blurtText =
    'Simplest explanation wins when two theories explain the evidence the same. Named after William of Ockham. ' +
    'More assumptions means more chances to be wrong. Related to overfitting in machine learning.';
  const cmp = compareRecall(masterText(occam), blurtText);
  const blurts: BlurtSession[] = [
    {
      id: 'blurt-seed-1',
      topicId: T_OCCAM,
      content: blurtText,
      durationSec: 180,
      elapsedSec: 142,
      coverage: cmp.coverage,
      recall: cmp.suggested,
      recalledTerms: cmp.recalled.map((t) => t.term),
      missedTerms: cmp.missed.map((t) => t.term),
      createdAt: addDays(today, -2).toISOString()
    }
  ];

  const draftText =
    'Backpressure is basically a mechanism that facilitates flow control between asynchronous components in a ' +
    'distributed system so that the producer does not overwhelm the consumer. Imagine a kitchen: if the chef cooks ' +
    'faster than the waiters can carry plates, plates pile up. So the waiters tell the chef to slow down. ' +
    'In TCP the receiver sends a window size.';
  const scan = scanText(draftText);
  const drafts: FeynmanDraft[] = [
    {
      id: 'draft-seed-1',
      topicId: T_BACKPRESSURE,
      explanation: draftText,
      gaps: [
        {
          id: 'gap-seed-1',
          text: 'Why exactly does latency grow when the queue grows? (I hesitated on Little’s Law.)',
          createdAt: addDays(today, -3).toISOString(),
          cardId: null
        }
      ],
      clarityScore: scan.clarityScore,
      readingGrade: scan.readingGrade,
      createdAt: addDays(today, -3).toISOString(),
      updatedAt: addDays(today, -3).toISOString()
    }
  ];

  const syntheses: SynthesisEntry[] = [
    {
      id: 'syn-seed-1',
      kind: 'bridge',
      question: 'How does Backpressure (Systems Architecture) relate to Homeostatic plasticity (Physiology)?',
      topicIds: [T_BACKPRESSURE, T_NEURO],
      response:
        'Both are negative-feedback loops that protect a system from runaway load. Homeostatic plasticity scales ' +
        'down synaptic strength when a neuron fires too much; backpressure slows the producer when the consumer is ' +
        'saturated. Difference: neurons adjust the receiver’s sensitivity, pipelines adjust the sender’s rate.',
      createdAt: addDays(today, -4).toISOString(),
      cardId: null
    }
  ];

  return {
    version: SCHEMA_VERSION,
    createdAt: nowIso,
    topics: seededTopics,
    cards,
    reviews,
    drafts,
    blurts,
    syntheses,
    settings: { ...DEFAULT_SETTINGS }
  };
}
