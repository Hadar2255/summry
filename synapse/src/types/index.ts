/** Core domain model for Synapse. Every persisted entity is described here. */

export type ID = string;
/** ISO-8601 timestamp string. */
export type ISODate = string;

export interface MentalModel {
  id: ID;
  name: string;
  description: string;
}

/** A directed, labelled relation from one topic to a topic in (usually) another field. */
export interface CrossDomainLink {
  id: ID;
  targetTopicId: ID;
  relation: string;
}

export interface Topic {
  id: ID;
  title: string;
  domain: string;
  /** The single idea you should be able to state from memory. */
  coreTenet: string;
  /** Condensed notes from the source material — the "master" copy used for recall diffs. */
  sourceSummary: string;
  /** Book, paper, course, URL… */
  source: string;
  mentalModels: MentalModel[];
  tags: string[];
  links: CrossDomainLink[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

/** Adapted SM-2 state with a Leitner box mirror for at-a-glance progress. */
export interface SRSState {
  ease: number;
  /** Current interval in days. 0 means "in (re)learning". */
  interval: number;
  repetitions: number;
  lapses: number;
  box: LeitnerBox;
  due: ISODate;
  lastReviewed: ISODate | null;
}

export type CardOrigin = 'seed' | 'manual' | 'feynman-gap' | 'blurt-miss' | 'synthesis' | 'quick-capture';

export interface Card {
  id: ID;
  topicId: ID;
  prompt: string;
  answer: string;
  origin: CardOrigin;
  suspended: boolean;
  srs: SRSState;
  createdAt: ISODate;
}

/** Accuracy self-grade after reveal: 1 Again · 2 Hard · 3 Good · 4 Easy. */
export type Grade = 1 | 2 | 3 | 4;
/** Confidence before reveal: 1 Guessing · 2 Unsure · 3 Fairly sure · 4 Certain. */
export type Confidence = 1 | 2 | 3 | 4;

export interface ReviewLog {
  id: ID;
  cardId: ID;
  topicId: ID;
  reviewedAt: ISODate;
  confidence: Confidence;
  grade: Grade;
  correct: boolean;
  responseMs: number;
  interleaved: boolean;
  previousInterval: number;
  nextInterval: number;
}

export interface KnowledgeGap {
  id: ID;
  text: string;
  createdAt: ISODate;
  /** Set once the gap has been turned into a study card. */
  cardId: ID | null;
}

export interface FeynmanDraft {
  id: ID;
  topicId: ID;
  explanation: string;
  gaps: KnowledgeGap[];
  clarityScore: number;
  readingGrade: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type RecallLevel = 'high' | 'medium' | 'low';

export interface BlurtSession {
  id: ID;
  topicId: ID;
  content: string;
  durationSec: number;
  elapsedSec: number;
  coverage: number;
  recall: RecallLevel;
  recalledTerms: string[];
  missedTerms: string[];
  createdAt: ISODate;
}

export type SynthesisKind = 'bridge' | 'failure' | 'counter' | 'mechanism' | 'analogy' | 'transfer' | 'prediction';

export interface SynthesisEntry {
  id: ID;
  kind: SynthesisKind;
  question: string;
  topicIds: ID[];
  response: string;
  createdAt: ISODate;
  cardId: ID | null;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  audioCues: boolean;
  ambientSound: boolean;
  blurtDurationSec: number;
  dailyReviewLimit: number;
  interleave: boolean;
  minInterleaveTopics: number;
}

export const SCHEMA_VERSION = 1 as const;

export interface AppState {
  version: typeof SCHEMA_VERSION;
  topics: Topic[];
  cards: Card[];
  reviews: ReviewLog[];
  drafts: FeynmanDraft[];
  blurts: BlurtSession[];
  syntheses: SynthesisEntry[];
  settings: Settings;
  createdAt: ISODate;
}

export type View = 'dashboard' | 'topics' | 'feynman' | 'gym' | 'review' | 'synthesis' | 'settings';

export interface NavTarget {
  view: View;
  topicId?: ID;
}
