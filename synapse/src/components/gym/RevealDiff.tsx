import { useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { RecallLevel, Topic } from '../../types';
import { markTerms, type KeyTerm, type RecallComparison } from '../../utils/recall';
import { useHotkeys } from '../../hooks/useHotkeys';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';

const LEVELS: Array<{ level: RecallLevel; key: string; label: string; body: string; tone: string }> = [
  { level: 'high', key: '1', label: 'High', body: 'Got the core and most details', tone: 'border-good/40 bg-good/10 text-good' },
  { level: 'medium', key: '2', label: 'Medium', body: 'Core idea, patchy details', tone: 'border-warn/40 bg-warn/10 text-warn' },
  { level: 'low', key: '3', label: 'Low', body: 'Fragments or misconceptions', tone: 'border-bad/40 bg-bad/10 text-bad' }
];

export function RevealDiff({
  topic,
  master,
  dump,
  comparison,
  elapsedSec,
  onFinish
}: {
  topic: Topic;
  master: string;
  dump: string;
  comparison: RecallComparison;
  elapsedSec: number;
  onFinish: (recall: RecallLevel, missedForCards: KeyTerm[]) => void;
}) {
  const [recall, setRecall] = useState<RecallLevel | null>(null);
  const [cardTerms, setCardTerms] = useState<Set<string>>(new Set());
  const segments = useMemo(() => markTerms(master, comparison.recalled, comparison.missed), [master, comparison]);

  useHotkeys([
    { combo: '1', handler: () => setRecall('high') },
    { combo: '2', handler: () => setRecall('medium') },
    { combo: '3', handler: () => setRecall('low') },
    {
      combo: 'enter',
      handler: () => {
        if (recall) onFinish(recall, comparison.missed.filter((t) => cardTerms.has(t.stem)));
      }
    }
  ]);

  const toggle = (t: KeyTerm) =>
    setCardTerms((s) => {
      const n = new Set(s);
      if (n.has(t.stem)) n.delete(t.stem);
      else n.add(t.stem);
      return n;
    });

  const pct = Math.round(comparison.coverage * 100);

  return (
    <div className="animate-rise-in space-y-6">
      <div className="text-center">
        <p className="eyebrow">Reveal & diff</p>
        <h3 className="display mt-2 text-3xl">
          You recalled <span className="text-accent">{pct}%</span> of the key ideas
        </h3>
        <p className="mt-2 text-sm text-muted">
          {comparison.recalled.length} of {comparison.recalled.length + comparison.missed.length} key terms · {Math.round(elapsedSec)}s of blurting
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <p className="eyebrow mb-3">Your dump</p>
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed">{dump.trim() || <span className="text-faint">(empty)</span>}</p>
        </section>
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">Master notes · {topic.title}</p>
            <span className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-good">
                <span className="h-2 w-2 rounded-full bg-good" /> recalled
              </span>
              <span className="flex items-center gap-1 text-warn">
                <span className="h-2 w-2 rounded-full bg-warn" /> missed
              </span>
            </span>
          </div>
          <p className="max-h-[360px] overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed text-ink/85">
            {segments.map((s, i) =>
              s.state === 'recalled' ? (
                <mark key={i} className="rounded bg-good/15 px-0.5 text-good">
                  {s.text}
                </mark>
              ) : s.state === 'missed' ? (
                <mark key={i} className="rounded bg-warn/15 px-0.5 text-warn">
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              )
            )}
          </p>
        </section>
      </div>

      {comparison.missed.length > 0 && (
        <section className="card p-5">
          <p className="eyebrow mb-1">Missed concepts</p>
          <p className="mb-3 text-[13px] text-muted">Select the ones worth a study card — they’ll be added to your deck.</p>
          <div className="flex flex-wrap gap-2">
            {comparison.missed.map((t) => {
              const on = cardTerms.has(t.stem);
              return (
                <button
                  key={t.stem}
                  onClick={() => toggle(t)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] transition ${on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'}`}
                >
                  {on ? <Check size={13} /> : <Sparkles size={13} />}
                  {t.term}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <p className="eyebrow mb-3 text-center">Grade your own recall accuracy</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <button
              key={l.level}
              onClick={() => setRecall(l.level)}
              className={`relative rounded-2xl border p-4 text-left transition ${recall === l.level ? l.tone : 'border-line bg-surface hover:border-faint'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{l.label}</span>
                <Kbd>{l.key}</Kbd>
              </div>
              <p className={`mt-1 text-[12.5px] ${recall === l.level ? '' : 'text-muted'}`}>{l.body}</p>
              {comparison.suggested === l.level && (
                <span className="absolute -top-2 right-3 rounded-full bg-ink px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-canvas">
                  suggested
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            disabled={!recall}
            onClick={() => recall && onFinish(recall, comparison.missed.filter((t) => cardTerms.has(t.stem)))}
            trailing={<Kbd className="ml-1 !border-transparent !bg-white/20 !text-current">↵</Kbd>}
          >
            Save session{cardTerms.size ? ` & add ${cardTerms.size} card${cardTerms.size > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </section>
    </div>
  );
}
