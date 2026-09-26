import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type {
  AppState,
  BlurtSession,
  Card,
  CardOrigin,
  Confidence,
  FeynmanDraft,
  Grade,
  ID,
  KnowledgeGap,
  Settings,
  SynthesisEntry,
  Topic
} from '../types';
import { createSeedState } from '../utils/seed';
import { loadState, saveState } from '../utils/storage';
import { newSRS, schedule } from '../utils/srs';
import { uid } from '../utils/id';

export type Action =
  | { type: 'replace'; state: AppState }
  | { type: 'topic/upsert'; topic: Topic }
  | { type: 'topic/delete'; id: ID }
  | { type: 'card/add'; card: Card }
  | { type: 'card/update'; id: ID; patch: Partial<Pick<Card, 'prompt' | 'answer' | 'suspended' | 'topicId'>> }
  | { type: 'card/delete'; id: ID }
  | { type: 'card/reset'; id: ID }
  | {
      type: 'review/record';
      cardId: ID;
      grade: Grade;
      confidence: Confidence;
      responseMs: number;
      interleaved: boolean;
      at: string;
    }
  | { type: 'draft/upsert'; draft: FeynmanDraft }
  | { type: 'draft/delete'; id: ID }
  | { type: 'blurt/add'; blurt: BlurtSession }
  | { type: 'synthesis/add'; entry: SynthesisEntry }
  | { type: 'synthesis/update'; id: ID; patch: Partial<SynthesisEntry> }
  | { type: 'synthesis/delete'; id: ID }
  | { type: 'settings/update'; patch: Partial<Settings> };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'replace':
      return action.state;
    case 'topic/upsert': {
      const exists = state.topics.some((t) => t.id === action.topic.id);
      return {
        ...state,
        topics: exists
          ? state.topics.map((t) => (t.id === action.topic.id ? action.topic : t))
          : [...state.topics, action.topic]
      };
    }
    case 'topic/delete': {
      const cardIds = new Set(state.cards.filter((c) => c.topicId === action.id).map((c) => c.id));
      return {
        ...state,
        topics: state.topics
          .filter((t) => t.id !== action.id)
          .map((t) => ({ ...t, links: t.links.filter((l) => l.targetTopicId !== action.id) })),
        cards: state.cards.filter((c) => c.topicId !== action.id),
        reviews: state.reviews.filter((r) => !cardIds.has(r.cardId)),
        drafts: state.drafts.filter((d) => d.topicId !== action.id),
        blurts: state.blurts.filter((b) => b.topicId !== action.id),
        syntheses: state.syntheses.filter((s) => !s.topicIds.includes(action.id))
      };
    }
    case 'card/add':
      return { ...state, cards: [...state.cards, action.card] };
    case 'card/update':
      return { ...state, cards: state.cards.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) };
    case 'card/delete':
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.id),
        reviews: state.reviews.filter((r) => r.cardId !== action.id)
      };
    case 'card/reset':
      return { ...state, cards: state.cards.map((c) => (c.id === action.id ? { ...c, srs: newSRS() } : c)) };
    case 'review/record': {
      const card = state.cards.find((c) => c.id === action.cardId);
      if (!card) return state;
      const at = new Date(action.at);
      const next = schedule(card.srs, action.grade, action.confidence, at);
      return {
        ...state,
        cards: state.cards.map((c) => (c.id === card.id ? { ...c, srs: next } : c)),
        reviews: [
          ...state.reviews,
          {
            id: uid(),
            cardId: card.id,
            topicId: card.topicId,
            reviewedAt: action.at,
            confidence: action.confidence,
            grade: action.grade,
            correct: action.grade >= 2,
            responseMs: action.responseMs,
            interleaved: action.interleaved,
            previousInterval: card.srs.interval,
            nextInterval: next.interval
          }
        ]
      };
    }
    case 'draft/upsert': {
      const exists = state.drafts.some((d) => d.id === action.draft.id);
      return {
        ...state,
        drafts: exists
          ? state.drafts.map((d) => (d.id === action.draft.id ? action.draft : d))
          : [...state.drafts, action.draft]
      };
    }
    case 'draft/delete':
      return { ...state, drafts: state.drafts.filter((d) => d.id !== action.id) };
    case 'blurt/add':
      return { ...state, blurts: [...state.blurts, action.blurt] };
    case 'synthesis/add':
      return { ...state, syntheses: [...state.syntheses, action.entry] };
    case 'synthesis/update':
      return {
        ...state,
        syntheses: state.syntheses.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s))
      };
    case 'synthesis/delete':
      return { ...state, syntheses: state.syntheses.filter((s) => s.id !== action.id) };
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };
  }
}

export function makeCard(topicId: ID, prompt: string, answer: string, origin: CardOrigin): Card {
  const now = new Date();
  return {
    id: uid(),
    topicId,
    prompt: prompt.trim(),
    answer: answer.trim(),
    origin,
    suspended: false,
    srs: newSRS(now),
    createdAt: now.toISOString()
  };
}

export function makeGap(text: string): KnowledgeGap {
  return { id: uid(), text: text.trim(), createdAt: new Date().toISOString(), cardId: null };
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface StoreValue {
  state: AppState;
  dispatch: (a: Action) => void;
  ready: boolean;
  saveStatus: SaveStatus;
  storageBackend: 'idb' | 'local' | null;
  topicById: (id: ID | null | undefined) => Topic | undefined;
  resetToDemo: () => void;
  wipe: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createSeedState());
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [storageBackend, setBackend] = useState<'idb' | 'local' | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    loadState().then((loaded) => {
      if (cancelled) return;
      if (loaded) {
        skipNextSave.current = true;
        dispatch({ type: 'replace', state: loaded });
      } else {
        // First launch: persist the demo data straight away.
        skipNextSave.current = false;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveStatus('saving');
    const t = window.setTimeout(() => {
      saveState(state)
        .then((backend) => {
          setBackend(backend);
          setSaveStatus('saved');
        })
        .catch(() => setSaveStatus('error'));
    }, 350);
    return () => window.clearTimeout(t);
  }, [state, ready]);

  useEffect(() => {
    try {
      localStorage.setItem('synapse:theme', state.settings.theme);
    } catch {
      // storage blocked — theme falls back to system on next load
    }
  }, [state.settings.theme]);

  const topicById = useCallback((id: ID | null | undefined) => state.topics.find((t) => t.id === id), [state.topics]);

  const resetToDemo = useCallback(() => dispatch({ type: 'replace', state: createSeedState() }), []);
  const wipe = useCallback(() => {
    const fresh = createSeedState();
    dispatch({
      type: 'replace',
      state: { ...fresh, topics: [], cards: [], reviews: [], drafts: [], blurts: [], syntheses: [], settings: state.settings }
    });
  }, [state.settings]);

  const value = useMemo<StoreValue>(
    () => ({ state, dispatch, ready, saveStatus, storageBackend, topicById, resetToDemo, wipe }),
    [state, ready, saveStatus, storageBackend, topicById, resetToDemo, wipe]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
