import { SCHEMA_VERSION, type AppState, type Settings } from '../types';
import { uid } from './id';

/**
 * Persistence: IndexedDB as the primary store with a localStorage mirror as fallback
 * (private windows and some embedded browsers block IndexedDB).
 */

const DB_NAME = 'synapse';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'synapse:state';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  audioCues: true,
  ambientSound: false,
  blurtDurationSec: 180,
  dailyReviewLimit: 60,
  interleave: true,
  minInterleaveTopics: 3
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadState(): Promise<AppState | null> {
  try {
    const fromIdb = await idbGet<unknown>(KEY);
    if (fromIdb) return normalizeState(fromIdb);
  } catch {
    // fall through to localStorage
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {
    // corrupted or unavailable
  }
  return null;
}

export async function saveState(state: AppState): Promise<'idb' | 'local'> {
  try {
    await idbSet(KEY, state);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    return 'idb';
  } catch {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return 'local';
  }
}

export class ImportError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/** Validates untrusted data (imports, older saves) and fills in any missing fields. */
export function normalizeState(input: unknown): AppState {
  if (!isObj(input)) throw new ImportError('File is not a Synapse backup (expected a JSON object).');
  const data = isObj(input.data) && input.app === 'synapse' ? input.data : input;
  if (!isObj(data)) throw new ImportError('Backup payload is malformed.');
  if (typeof data.version === 'number' && data.version > SCHEMA_VERSION) {
    throw new ImportError(`Backup is from a newer Synapse (schema v${data.version}). Update the app first.`);
  }
  for (const key of ['topics', 'cards'] as const) {
    if (!isArr(data[key])) throw new ImportError(`Backup is missing the “${key}” list.`);
  }
  const topics = (data.topics as unknown[]).filter(isObj);
  for (const t of topics) {
    if (typeof t.id !== 'string' || typeof t.title !== 'string') {
      throw new ImportError('A topic in the backup has no id or title.');
    }
  }
  const topicIds = new Set(topics.map((t) => t.id as string));
  const cards = (data.cards as unknown[]).filter(isObj);
  for (const c of cards) {
    if (typeof c.id !== 'string' || typeof c.topicId !== 'string' || !isObj(c.srs)) {
      throw new ImportError('A card in the backup is missing its id, topic or schedule.');
    }
  }
  const now = new Date().toISOString();
  const settings = isObj(data.settings) ? data.settings : {};

  return {
    version: SCHEMA_VERSION,
    createdAt: str(data.createdAt, now),
    topics: topics.map((t) => ({
      id: t.id as string,
      title: t.title as string,
      domain: str(t.domain, 'General'),
      coreTenet: str(t.coreTenet),
      sourceSummary: str(t.sourceSummary),
      source: str(t.source),
      mentalModels: isArr(t.mentalModels)
        ? t.mentalModels.filter(isObj).map((m) => ({
            id: str(m.id, uid()),
            name: str(m.name),
            description: str(m.description)
          }))
        : [],
      tags: isArr(t.tags) ? t.tags.filter((x): x is string => typeof x === 'string') : [],
      links: isArr(t.links)
        ? t.links
            .filter(isObj)
            .filter((l) => typeof l.targetTopicId === 'string' && topicIds.has(l.targetTopicId))
            .map((l) => ({ id: str(l.id, uid()), targetTopicId: l.targetTopicId as string, relation: str(l.relation) }))
        : [],
      createdAt: str(t.createdAt, now),
      updatedAt: str(t.updatedAt, now)
    })),
    cards: cards
      .filter((c) => topicIds.has(c.topicId as string))
      .map((c) => {
        const s = c.srs as Record<string, unknown>;
        const box = Math.min(5, Math.max(1, Math.round(Number(s.box) || 1))) as 1 | 2 | 3 | 4 | 5;
        return {
          id: c.id as string,
          topicId: c.topicId as string,
          prompt: str(c.prompt),
          answer: str(c.answer),
          origin: (str(c.origin, 'manual') as AppState['cards'][number]['origin']),
          suspended: c.suspended === true,
          createdAt: str(c.createdAt, now),
          srs: {
            ease: Number(s.ease) || 2.5,
            interval: Number(s.interval) || 0,
            repetitions: Number(s.repetitions) || 0,
            lapses: Number(s.lapses) || 0,
            box,
            due: str(s.due, now),
            lastReviewed: typeof s.lastReviewed === 'string' ? s.lastReviewed : null
          }
        };
      }),
    reviews: (isArr(data.reviews) ? data.reviews.filter(isObj) : []) as unknown as AppState['reviews'],
    drafts: (isArr(data.drafts) ? data.drafts.filter(isObj) : []).map((d) => ({
      ...(d as unknown as AppState['drafts'][number]),
      gaps: isArr(d.gaps) ? (d.gaps.filter(isObj) as unknown as AppState['drafts'][number]['gaps']) : []
    })),
    blurts: (isArr(data.blurts) ? data.blurts.filter(isObj) : []) as unknown as AppState['blurts'],
    syntheses: (isArr(data.syntheses) ? data.syntheses.filter(isObj) : []) as unknown as AppState['syntheses'],
    settings: { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings>) }
  };
}

export function exportPayload(state: AppState): string {
  return JSON.stringify({ app: 'synapse', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

/**
 * Saves a backup. On iPad/iPhone (especially when installed to the home screen) the share sheet is the
 * reliable way to reach Files, AirDrop or iCloud Drive, so it's preferred when the browser supports sharing files.
 */
export async function saveBackup(filename: string, contents: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([contents], filename, { type: 'application/json' });
  const touch = typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (touch && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Synapse backup' });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Fall through to a regular download.
    }
  }
  downloadJson(filename, contents);
  return 'downloaded';
}

export function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
