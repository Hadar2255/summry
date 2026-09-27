import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, Trash2, Monitor, Sun, Moon, Volume2, Waves, Shuffle, Database } from 'lucide-react';
import type { Settings, ThemePreference } from '../../types';
import { useStore } from '../../hooks/useStore';
import { exportPayload, ImportError, normalizeState, saveBackup } from '../../utils/storage';
import { dayKey, formatClock } from '../../utils/date';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${on ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-4' : ''}`} />
    </button>
  );
}

function Row({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="mt-0.5 text-muted">{icon}</span>
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 text-[13px] text-muted">{body}</p>
        </div>
      </div>
      <div className="pl-8 sm:pl-0">{children}</div>
    </div>
  );
}

const PRINCIPLES = [
  ['Retrieval practice', 'Pulling information out of memory strengthens it far more than re-reading. Every screen here asks you to produce, not recognise.'],
  ['Spaced repetition', 'Reviews are scheduled at growing intervals just before forgetting, using an adapted SM-2 algorithm mirrored as Leitner boxes.'],
  ['Interleaving', 'Mixing unrelated topics forces you to identify which idea applies — harder in the moment, better for long-term transfer.'],
  ['The Feynman technique', 'Explaining in plain language exposes gaps that jargon hides. Gaps become cards.'],
  ['Blurting', 'A timed free-recall dump before checking notes reveals what you actually know.'],
  ['Elaborative interrogation', 'Asking “why?” and “how does this connect?” integrates new ideas into existing knowledge.'],
  ['Metacognitive calibration', 'Rating confidence before each reveal trains you to notice the illusion of competence.']
];

export function SettingsPanel() {
  const { state, dispatch, resetToDemo, wipe, storageBackend } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<'demo' | 'wipe' | null>(null);
  const s = state.settings;
  const set = (patch: Partial<Settings>) => dispatch({ type: 'settings/update', patch });

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = normalizeState(JSON.parse(text));
      dispatch({ type: 'replace', state: parsed });
      toast(`Imported ${parsed.topics.length} topics and ${parsed.cards.length} cards`);
    } catch (err) {
      toast(err instanceof ImportError ? err.message : 'That file is not valid JSON.', 'bad');
    }
  };

  const themes: Array<[ThemePreference, React.ReactNode, string]> = [
    ['system', <Monitor size={15} key="m" />, 'System'],
    ['light', <Sun size={15} key="s" />, 'Light'],
    ['dark', <Moon size={15} key="d" />, 'Dark']
  ];

  return (
    <div className="animate-rise-in">
      <PageHeader eyebrow="Preferences" title="Settings" description="Tune the session engine, sound, appearance and your data." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="card divide-y divide-line px-6">
            <Row icon={<Sun size={17} />} title="Appearance" body="Follow the OS, or pin light or dark.">
              <div className="flex rounded-lg bg-raised p-0.5">
                {themes.map(([v, icon, label]) => (
                  <button
                    key={v}
                    onClick={() => set({ theme: v })}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition ${s.theme === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </Row>
            <Row icon={<Volume2 size={17} />} title="Audio cues" body="Soft chimes on reveal, grading and when a timer ends.">
              <Toggle on={s.audioCues} onChange={(v) => set({ audioCues: v })} label="Audio cues" />
            </Row>
            <Row icon={<Waves size={17} />} title="Ambient sound" body="Gentle brown noise during focus sessions.">
              <Toggle on={s.ambientSound} onChange={(v) => set({ ambientSound: v })} label="Ambient sound" />
            </Row>
          </section>

          <section className="card divide-y divide-line px-6">
            <Row icon={<Shuffle size={17} />} title="Interleave Mode" body="Mix topics within review sessions.">
              <Toggle on={s.interleave} onChange={(v) => set({ interleave: v })} label="Interleave mode" />
            </Row>
            <Row icon={<Shuffle size={17} />} title="Minimum topics per session" body="Pull cards forward so each session spans at least this many topics.">
              <div className="flex items-center gap-3">
                <input type="range" min={2} max={6} value={s.minInterleaveTopics} onChange={(e) => set({ minInterleaveTopics: Number(e.target.value) })} className="accent-[rgb(var(--accent))]" />
                <span className="w-6 font-mono text-sm">{s.minInterleaveTopics}</span>
              </div>
            </Row>
            <Row icon={<Database size={17} />} title="Daily review limit" body="Maximum due cards in one day’s deck.">
              <input
                type="number"
                min={5}
                max={500}
                value={s.dailyReviewLimit}
                onChange={(e) => set({ dailyReviewLimit: Math.max(5, Math.min(500, Number(e.target.value) || 5)) })}
                className="input w-24 text-center font-mono"
              />
            </Row>
            <Row icon={<Database size={17} />} title="Default blurt timer" body="Starting duration in the Retrieval Gym.">
              <select className="input w-28 cursor-pointer font-mono" value={s.blurtDurationSec} onChange={(e) => set({ blurtDurationSec: Number(e.target.value) })}>
                {[60, 120, 180, 300, 600].map((d) => (
                  <option key={d} value={d}>
                    {formatClock(d)}
                  </option>
                ))}
              </select>
            </Row>
          </section>

          <section className="card p-6">
            <p className="font-medium">Your data</p>
            <p className="mt-1 text-[13px] text-muted">
              Everything lives in this browser ({storageBackend === 'local' ? 'localStorage' : 'IndexedDB'}). Nothing is sent anywhere. Export regularly to keep a backup or move devices.
            </p>
            <div className="mt-3 font-mono text-[12px] text-faint">
              {state.topics.length} topics · {state.cards.length} cards · {state.reviews.length} reviews · {state.drafts.length} drafts · {state.blurts.length} blurts ·{' '}
              {state.syntheses.length} bridges
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="primary" icon={<Download size={15} />} onClick={() =>
                  void saveBackup(`synapse-backup-${dayKey(new Date())}.json`, exportPayload(state)).then((r) => {
                    if (r === 'shared') toast('Backup exported');
                  })
                }
              >
                Export JSON
              </Button>
              <Button variant="secondary" icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>
                Import JSON
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json,public.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImport(f);
                  e.target.value = '';
                }}
              />
              <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => setConfirm('demo')}>
                Restore demo data
              </Button>
              <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setConfirm('wipe')}>
                Erase everything
              </Button>
            </div>
            <p className="mt-3 text-[12px] text-faint">Importing replaces your current data.</p>
          </section>
        </div>

        <aside className="card p-6">
          <p className="eyebrow mb-4">The science inside</p>
          <ol className="space-y-4">
            {PRINCIPLES.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="font-mono text-[11px] text-accent">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="font-medium leading-snug">{title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        width="sm"
        title={confirm === 'wipe' ? 'Erase everything?' : 'Restore demo data?'}
        subtitle={
          confirm === 'wipe'
            ? 'All topics, cards and history will be deleted from this browser. Settings are kept.'
            : 'Your current data will be replaced by the three sample topics and simulated history.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm === 'wipe') wipe();
                else resetToDemo();
                setConfirm(null);
                toast(confirm === 'wipe' ? 'All data erased' : 'Demo data restored');
              }}
            >
              {confirm === 'wipe' ? 'Erase' : 'Replace with demo'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Tip: export a JSON backup first — it can be re-imported at any time.</p>
      </Modal>
    </div>
  );
}
