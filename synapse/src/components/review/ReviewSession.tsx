import { useMemo, useRef, useState } from 'react';
import { CalendarCheck, Layers, Play, Shuffle, Sparkles, Trophy, FastForward } from 'lucide-react';
import type { Confidence, Grade } from '../../types';
import { useStore } from '../../hooks/useStore';
import { useNav } from '../../hooks/useNav';
import { useAudioCue } from '../../hooks/useAudio';
import { useHotkeys } from '../../hooks/useHotkeys';
import { buildDailyDeck, interleaveOrder, switchRate, type DeckItem } from '../../utils/interleave';
import { CONFIDENCE_PROB } from '../../utils/srs';
import { formatClock, relativeDay } from '../../utils/date';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { DomainDot } from '../ui/DomainChip';
import { EmptyState } from '../ui/EmptyState';
import { FocusSession } from '../focus/FocusSession';
import { ReviewCard, type GradeResult } from './ReviewCard';

interface QueueItem extends DeckItem {
  key: string;
  relearn: boolean;
}

interface SessionResult {
  cardId: string;
  topicId: string;
  grade: Grade;
  confidence: Confidence;
}

export function ReviewSession() {
  const { state, dispatch, topicById } = useStore();
  const { navigate } = useNav();
  const cue = useAudioCue();
  const { settings } = state;

  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<SessionResult[]>([]);
  const startedAt = useRef(Date.now());
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const now = new Date();
  const deck = useMemo(
    () =>
      buildDailyDeck(state.cards, state.topics, {
        now: new Date(),
        limit: settings.dailyReviewLimit,
        interleave: settings.interleave,
        minTopics: settings.minInterleaveTopics
      }),
    // A running session works from its own frozen queue, so the preview can refresh freely.
    [state.cards, state.topics, settings.dailyReviewLimit, settings.interleave, settings.minInterleaveTopics]
  );

  const aheadDeck = useMemo(() => {
    const upcoming = state.cards
      .filter((c) => !c.suspended && new Date(c.srs.due) > new Date())
      .sort((a, b) => a.srs.due.localeCompare(b.srs.due))
      .slice(0, 20)
      .map((card) => ({ card, bonus: false }));
    return interleaveOrder(upcoming, (i) => i.card.topicId, (i) => topicById(i.card.topicId)?.domain ?? '');
  }, [state.cards, topicById]);

  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of deck) m.set(d.card.topicId, (m.get(d.card.topicId) ?? 0) + 1);
    return [...m.entries()];
  }, [deck]);

  const begin = (items: DeckItem[]) => {
    if (!items.length) return;
    setQueue(items.map((d, i) => ({ ...d, key: `${d.card.id}-${i}`, relearn: false })));
    setIndex(0);
    setResults([]);
    setFinishedAt(null);
    startedAt.current = Date.now();
    cue('start');
  };

  const exit = () => {
    setQueue(null);
    setFinishedAt(null);
  };

  useHotkeys([{ combo: 'enter', handler: () => begin(deck.length ? deck : aheadDeck) }], queue === null);

  const current = queue && index < queue.length ? queue[index] : null;
  const liveCard = current ? state.cards.find((c) => c.id === current.card.id) ?? current.card : null;
  const prev = queue && index > 0 ? queue[index - 1] : null;
  const interleaved = !!queue && new Set(queue.map((q) => q.card.topicId)).size > 1;

  const onGrade = ({ grade, confidence, responseMs }: GradeResult) => {
    if (!queue || !current) return;
    dispatch({
      type: 'review/record',
      cardId: current.card.id,
      grade,
      confidence,
      responseMs,
      interleaved,
      at: new Date().toISOString()
    });
    setResults((r) => [...r, { cardId: current.card.id, topicId: current.card.topicId, grade, confidence }]);
    cue(grade === 1 ? 'fail' : 'success');

    let nextQueue = queue;
    if (grade === 1) {
      // Relearning step: bring the card back a few cards later within this session.
      const insertAt = Math.min(queue.length, index + 4);
      const copy: QueueItem = { ...current, key: `${current.card.id}-r${index}`, relearn: true };
      nextQueue = [...queue.slice(0, insertAt), copy, ...queue.slice(insertAt)];
      setQueue(nextQueue);
    }
    if (index + 1 >= nextQueue.length) {
      setFinishedAt(Date.now());
      cue('complete');
    }
    setIndex((i) => i + 1);
  };

  const summary = useMemo(() => {
    if (!results.length) return null;
    const correct = results.filter((r) => r.grade >= 2).length;
    const conf = results.reduce((s, r) => s + CONFIDENCE_PROB[r.confidence], 0) / results.length;
    const acc = correct / results.length;
    const overconfident = results.filter((r) => r.confidence >= 3 && r.grade === 1).length;
    const underconfident = results.filter((r) => r.confidence <= 2 && r.grade >= 3).length;
    return {
      total: results.length,
      acc,
      conf,
      overconfident,
      underconfident,
      topics: new Set(results.map((r) => r.topicId)).size,
      switchRate: switchRate(results, (r) => r.topicId)
    };
  }, [results]);

  if (!state.cards.length) {
    return (
      <EmptyState
        icon={<Layers size={22} />}
        title="No cards yet"
        body="Add cards to a topic, log gaps in the Feynman Studio, or capture one with ⌘K."
        action={<Button onClick={() => navigate('topics')}>Go to topics</Button>}
      />
    );
  }

  const bonusCount = deck.filter((d) => d.bonus).length;
  const dueCount = deck.length - bonusCount;
  const nextDue = state.cards
    .filter((c) => !c.suspended && new Date(c.srs.due) > now)
    .sort((a, b) => a.srs.due.localeCompare(b.srs.due))[0];

  return (
    <div className="animate-rise-in">
      <PageHeader
        eyebrow="Spaced repetition · Interleaving · Calibration"
        title="Daily Deck"
        description="Cards return just before you’d forget them (adapted SM-2 + Leitner boxes). Interleave Mode shuffles unrelated topics together, and you rate confidence before every reveal to expose the illusion of competence."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card relative overflow-hidden p-7 md:p-9">
          <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
          {deck.length ? (
            <>
              <p className="eyebrow">Today</p>
              <p className="display mt-3 text-[56px] leading-none tabular-nums">
                {dueCount}
                <span className="ml-3 font-sans text-lg text-muted">card{dueCount === 1 ? '' : 's'} due</span>
              </p>
              {bonusCount > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted">
                  <Shuffle size={13} className="text-accent" /> +{bonusCount} pulled forward so the session spans {settings.minInterleaveTopics} topics
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {topicCounts.map(([tid, n]) => {
                  const t = topicById(tid);
                  return t ? (
                    <span key={tid} className="flex items-center gap-2 rounded-full border border-line bg-canvas/50 py-1 pl-2.5 pr-3 text-[13px]">
                      <DomainDot domain={t.domain} /> {t.title} <span className="font-mono text-faint">{n}</span>
                    </span>
                  ) : null;
                })}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button variant="primary" size="lg" icon={<Play size={16} />} onClick={() => begin(deck)} trailing={<Kbd className="ml-1 !border-transparent !bg-white/20 !text-current">↵</Kbd>}>
                  Start focus session
                </Button>
                <span className="text-[13px] text-muted">≈ {Math.max(1, Math.round(deck.length * 0.4))} min</span>
              </div>
            </>
          ) : (
            <>
              <CalendarCheck size={30} className="text-good" />
              <p className="display mt-4 text-[32px] leading-tight">All caught up.</p>
              <p className="mt-2 max-w-md text-[14.5px] text-muted">
                Nothing is due{nextDue ? ` — next card ${relativeDay(nextDue.srs.due)}` : ''}. Reviewing early is less efficient, but a short interleaved practice round
                never hurts.
              </p>
              {aheadDeck.length > 0 && (
                <Button className="mt-6" variant="secondary" icon={<FastForward size={16} />} onClick={() => begin(aheadDeck)}>
                  Study ahead · {aheadDeck.length} cards
                </Button>
              )}
            </>
          )}
        </section>

        <aside className="card space-y-5 p-6">
          <div>
            <p className="eyebrow mb-3">Session mode</p>
            <button
              onClick={() => dispatch({ type: 'settings/update', patch: { interleave: !settings.interleave } })}
              className="flex w-full items-center justify-between rounded-xl border border-line p-4 text-left transition hover:border-faint"
              aria-pressed={settings.interleave}
            >
              <span>
                <span className="flex items-center gap-2 font-medium">
                  <Shuffle size={15} className={settings.interleave ? 'text-accent' : 'text-faint'} /> Interleave Mode
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-muted">
                  Alternate across ≥{settings.minInterleaveTopics} unrelated topics instead of blocking by topic.
                </span>
              </span>
              <span className={`ml-3 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${settings.interleave ? 'bg-accent' : 'bg-line'}`}>
                <span className={`h-5 w-5 rounded-full bg-white shadow transition ${settings.interleave ? 'translate-x-4' : ''}`} />
              </span>
            </button>
          </div>
          <div>
            <p className="eyebrow mb-3">Keyboard</p>
            <ul className="space-y-2 text-[13px] text-muted">
              <li className="flex items-center justify-between">
                Rate confidence <span className="flex gap-1"><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd><Kbd>4</Kbd></span>
              </li>
              <li className="flex items-center justify-between">
                Reveal answer <Kbd>Space</Kbd>
              </li>
              <li className="flex items-center justify-between">
                Grade Again → Easy <span className="flex gap-1"><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd><Kbd>4</Kbd></span>
              </li>
              <li className="flex items-center justify-between">
                Exit session <Kbd>Esc</Kbd>
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <FocusSession
        open={queue !== null}
        onExit={exit}
        title={interleaved ? 'Interleaved review' : 'Spaced review'}
        subtitle={queue ? `${Math.min(index + 1, queue.length)} of ${queue.length}` : undefined}
        progress={queue ? index / queue.length : 0}
      >
        {current && liveCard ? (
          <ReviewCard
            key={current.key}
            card={liveCard}
            topic={topicById(current.card.topicId)}
            switched={!!prev && prev.card.topicId !== current.card.topicId}
            bonus={current.bonus}
            relearn={current.relearn}
            onGrade={onGrade}
            onReveal={() => cue('reveal')}
          />
        ) : (
          summary && (
            <div className="animate-rise-in text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-good/10 text-good">
                <Trophy size={28} />
              </div>
              <h2 className="display mt-5 text-[40px] leading-tight">Session complete</h2>
              <p className="mt-2 text-muted">
                {summary.total} reviews · {formatClock(((finishedAt ?? Date.now()) - startedAt.current) / 1000)} · {summary.topics} topic{summary.topics === 1 ? '' : 's'}
              </p>
              <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {[
                  ['Accuracy', `${Math.round(summary.acc * 100)}%`, 'graded Hard or better'],
                  ['Confidence', `${Math.round(summary.conf * 100)}%`, summary.conf - summary.acc > 0.08 ? 'higher than accuracy — overconfident' : summary.acc - summary.conf > 0.08 ? 'lower than accuracy — trust yourself more' : 'well calibrated'],
                  ['Topic switches', `${Math.round(summary.switchRate * 100)}%`, 'of transitions changed context']
                ].map(([k, v, hint]) => (
                  <div key={k} className="card p-5">
                    <p className="eyebrow">{k}</p>
                    <p className="display mt-2 text-3xl">{v}</p>
                    <p className="mt-1 text-[12px] text-muted">{hint}</p>
                  </div>
                ))}
              </div>
              {(summary.overconfident > 0 || summary.underconfident > 0) && (
                <p className="mx-auto mt-6 max-w-lg text-[13.5px] leading-relaxed text-muted">
                  <Sparkles size={14} className="mr-1 inline text-accent" />
                  {summary.overconfident > 0 && (
                    <>
                      <b className="font-medium text-ink">{summary.overconfident}</b> confident miss{summary.overconfident > 1 ? 'es' : ''} — these felt known but weren’t.{' '}
                    </>
                  )}
                  {summary.underconfident > 0 && (
                    <>
                      <b className="font-medium text-ink">{summary.underconfident}</b> unsure hit{summary.underconfident > 1 ? 's' : ''} — you know more than you think.
                    </>
                  )}
                </p>
              )}
              <div className="mt-8 flex justify-center gap-2">
                <Button variant="secondary" onClick={() => { exit(); navigate('dashboard'); }}>
                  Dashboard
                </Button>
                <Button variant="primary" onClick={exit}>
                  Done <Kbd className="ml-1 !border-transparent !bg-white/20 !text-current">Esc</Kbd>
                </Button>
              </div>
            </div>
          )
        )}
      </FocusSession>
    </div>
  );
}
