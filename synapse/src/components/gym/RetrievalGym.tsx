import { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Play, Timer, EyeOff } from 'lucide-react';
import type { ID, RecallLevel } from '../../types';
import { makeCard, useStore } from '../../hooks/useStore';
import { useNav } from '../../hooks/useNav';
import { useTimer } from '../../hooks/useTimer';
import { useAudioCue } from '../../hooks/useAudio';
import { modKeyLabel, useHotkeys } from '../../hooks/useHotkeys';
import { compareRecall, masterText, stem, type KeyTerm, type RecallComparison } from '../../utils/recall';
import { splitSentences } from '../../utils/jargon';
import { uid } from '../../utils/id';
import { formatClock, relativeDay } from '../../utils/date';
import { PageHeader } from '../ui/PageHeader';
import { TopicSelect } from '../ui/TopicSelect';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { DomainChip } from '../ui/DomainChip';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../ui/Toast';
import { FocusSession } from '../focus/FocusSession';
import { RevealDiff } from './RevealDiff';

type Phase = 'setup' | 'blurt' | 'reveal';

const DURATIONS = [60, 180, 300, 600];
const RECALL_TONE: Record<RecallLevel, string> = { high: 'text-good', medium: 'text-warn', low: 'text-bad' };

export function RetrievalGym() {
  const { state, dispatch, topicById } = useStore();
  const { topicId: navTopic, navigate } = useNav();
  const toast = useToast();
  const cue = useAudioCue();
  const [topicId, setTopicId] = useState<ID | null>(navTopic ?? state.topics[0]?.id ?? null);
  const [duration, setDuration] = useState(state.settings.blurtDurationSec);
  const [phase, setPhase] = useState<Phase>('setup');
  const [dump, setDump] = useState('');
  const [comparison, setComparison] = useState<RecallComparison | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dumpRef = useRef(dump);
  dumpRef.current = dump;

  const topic = topicById(topicId);
  const master = useMemo(() => (topic ? masterText(topic) : ''), [topic]);

  useEffect(() => {
    if (navTopic && topicById(navTopic)) setTopicId(navTopic);
  }, [navTopic, topicById]);

  const submit = () => {
    if (!topic) return;
    timer.pause();
    setElapsed(timer.elapsedSec);
    setComparison(compareRecall(master, dumpRef.current));
    setPhase('reveal');
    cue('reveal');
  };

  const timer = useTimer(duration, () => {
    cue('complete');
    submit();
  });

  const start = () => {
    if (!topic) return;
    setDump('');
    setComparison(null);
    timer.reset();
    setPhase('blurt');
    cue('start');
    window.setTimeout(() => {
      timer.start();
      textareaRef.current?.focus();
    }, 60);
  };

  const exit = () => {
    timer.reset();
    setPhase('setup');
  };

  useHotkeys([{ combo: 'mod+enter', allowInInput: true, handler: submit }], phase === 'blurt');
  useHotkeys([{ combo: 'enter', handler: start }], phase === 'setup' && !!topic);

  const finish = (recall: RecallLevel, missed: KeyTerm[]) => {
    if (!topic || !comparison) return;
    const sentences = splitSentences(master);
    for (const t of missed) {
      const sentence = sentences.find((s) => s.text.toLowerCase().split(/[^a-z'’]+/).some((w) => w && stem(w) === t.stem));
      dispatch({
        type: 'card/add',
        card: makeCard(topic.id, `In ${topic.title}, what is the role of “${t.term}”?`, sentence?.text ?? t.term, 'blurt-miss')
      });
    }
    dispatch({
      type: 'blurt/add',
      blurt: {
        id: uid(),
        topicId: topic.id,
        content: dump,
        durationSec: duration,
        elapsedSec: Math.round(elapsed),
        coverage: comparison.coverage,
        recall,
        recalledTerms: comparison.recalled.map((t) => t.term),
        missedTerms: comparison.missed.map((t) => t.term),
        createdAt: new Date().toISOString()
      }
    });
    cue(recall === 'low' ? 'fail' : 'success');
    toast(missed.length ? `Session saved · ${missed.length} card${missed.length > 1 ? 's' : ''} added` : 'Blurt session saved');
    setPhase('setup');
  };

  const history = useMemo(
    () => [...state.blurts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12),
    [state.blurts]
  );

  if (!state.topics.length) {
    return (
      <EmptyState
        icon={<Brain size={22} />}
        title="No concepts to recall"
        body="Add a topic with a source summary — that summary becomes the answer key for your blurts."
        action={<Button onClick={() => navigate('topics')}>Go to topics</Button>}
      />
    );
  }

  return (
    <div className="animate-rise-in">
      <PageHeader
        eyebrow="Retrieval practice · Blurting"
        title="Retrieval Gym"
        description="Close your notes. Dump everything you remember about one concept before the timer runs out — then compare against the master copy. Effortful recall is what builds durable memory."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card relative overflow-hidden p-7">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <p className="eyebrow mb-4">Set up a blurt</p>
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-muted">Concept</span>
              <TopicSelect topics={state.topics} value={topicId} onChange={setTopicId} />
            </label>
            <div>
              <span className="mb-1.5 block text-[13px] text-muted">Time box</span>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`rounded-xl border px-4 py-2 font-mono text-sm transition ${duration === d ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'}`}
                  >
                    {formatClock(d)}
                  </button>
                ))}
              </div>
            </div>
            {topic && (
              <div className="rounded-xl border border-line bg-canvas/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{topic.title}</span>
                  <DomainChip domain={topic.domain} />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted">
                  <EyeOff size={13} /> Notes stay hidden until you submit.
                </p>
              </div>
            )}
            <Button variant="primary" size="lg" onClick={start} disabled={!topic} icon={<Play size={16} />} trailing={<Kbd className="ml-1 !border-transparent !bg-white/20 !text-current">↵</Kbd>}>
              Start {formatClock(duration)} blurt
            </Button>
          </div>
        </section>

        <aside className="card p-5">
          <p className="eyebrow mb-3 flex items-center gap-1.5">
            <Timer size={12} /> Recent sessions
          </p>
          <ul className="space-y-1">
            {history.map((b) => {
              const t = topicById(b.topicId);
              return (
                <li key={b.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{t?.title ?? 'Deleted topic'}</p>
                    <p className="text-[12px] text-faint">
                      {relativeDay(b.createdAt)} · {Math.round(b.coverage * 100)}% coverage
                    </p>
                  </div>
                  <span className={`font-mono text-[11px] uppercase tracking-wide ${RECALL_TONE[b.recall]}`}>{b.recall}</span>
                </li>
              );
            })}
            {!history.length && <li className="px-2 py-4 text-[13px] text-muted">No blurts yet.</li>}
          </ul>
        </aside>
      </div>

      <FocusSession
        open={phase !== 'setup' && !!topic}
        onExit={exit}
        title={phase === 'reveal' ? `Reveal · ${topic?.title ?? ''}` : `Blurt · ${topic?.title ?? ''}`}
        subtitle={topic?.domain}
        countdown={
          phase === 'blurt'
            ? { remainingSec: timer.remainingSec, totalSec: duration, paused: !timer.running, onTogglePause: () => (timer.running ? timer.pause() : timer.start()) }
            : null
        }
        progress={phase === 'reveal' ? 1 : 0}
      >
        {phase === 'blurt' && topic && (
          <div className="animate-rise-in">
            <p className="eyebrow text-center">Everything you remember</p>
            <h2 className="display mt-3 text-center text-[34px] leading-tight md:text-[42px]">{topic.title}</h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-[14px] text-muted">
              Definitions, mechanisms, examples, names, connections, doubts. Don’t edit — just dump. Messy is fine.
            </p>
            <textarea
              ref={textareaRef}
              value={dump}
              onChange={(e) => setDump(e.target.value)}
              placeholder="Start typing…"
              className="mt-8 min-h-[45vh] w-full resize-none rounded-2xl border border-line bg-surface/70 p-6 font-display text-[19px] leading-[1.7] text-ink shadow-inner placeholder:text-faint focus:border-accent/40 focus:outline-none"
            />
            <div className="mt-4 flex items-center justify-between text-[12.5px] text-muted">
              <span className="font-mono">{dump.trim() ? dump.trim().split(/\s+/).length : 0} words</span>
              <Button variant="primary" onClick={submit} trailing={<span className="kbd-hint ml-1 font-mono text-[11px] opacity-70">{modKeyLabel}↵</span>}>
                I’m done — reveal
              </Button>
            </div>
          </div>
        )}
        {phase === 'reveal' && topic && comparison && (
          <RevealDiff topic={topic} master={master} dump={dump} comparison={comparison} elapsedSec={elapsed} onFinish={finish} />
        )}
      </FocusSession>
    </div>
  );
}
