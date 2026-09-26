import { useMemo } from 'react';
import { ArrowRight, Brain, Flame, GitMerge, Layers, Lightbulb, Plus, Target, Activity, Gauge } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import { useNav } from '../../hooks/useNav';
import { modKeyLabel } from '../../hooks/useHotkeys';
import { accuracy, calibration, dailyActivity, forecast, masteryByTopic, retentionHealth, streak } from '../../utils/metrics';
import { buildDailyDeck } from '../../utils/interleave';
import { dayKey } from '../../utils/date';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { ProgressRing } from '../ui/ProgressRing';
import { DomainChip, DomainDot } from '../ui/DomainChip';
import { ActivityStrip, CalibrationChart, ForecastBars, Sparkline } from './Charts';

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export function Dashboard() {
  const { state } = useStore();
  const { navigate } = useNav();
  const now = useMemo(() => new Date(), []);

  const m = useMemo(() => {
    const s = streak(state, now);
    const acc = accuracy(state.reviews, now);
    const ret = retentionHealth(state.cards, now);
    const cal = calibration(state.reviews, now);
    const fc = forecast(state.cards, now, 7);
    const act = dailyActivity(state, now, 28);
    const mastery = masteryByTopic(state, now);
    const deck = buildDailyDeck(state.cards, state.topics, {
      now,
      limit: state.settings.dailyReviewLimit,
      interleave: state.settings.interleave,
      minTopics: state.settings.minInterleaveTopics
    });
    const daily14 = act.slice(-14).map((d) => (d.reviews ? d.correct / d.reviews : null));
    const boxes = [1, 2, 3, 4, 5].map((b) => state.cards.filter((c) => !c.suspended && c.srs.box === b).length);
    const todayKey = dayKey(now);
    const reviewedToday = state.reviews.filter((r) => dayKey(r.reviewedAt) === todayKey).length;
    return { s, acc, ret, cal, fc, act, mastery, deck, daily14, boxes, reviewedToday };
  }, [state, now]);

  const dueNow = m.deck.filter((d) => !d.bonus).length;
  const deckTopics = new Set(m.deck.map((d) => d.card.topicId)).size;

  const suggestions = useMemo(() => {
    const out: Array<{ icon: typeof Brain; title: string; body: string; action: () => void; cta: string }> = [];
    const lastBlurtByTopic = new Map<string, string>();
    for (const b of state.blurts) {
      const prev = lastBlurtByTopic.get(b.topicId);
      if (!prev || prev < b.createdAt) lastBlurtByTopic.set(b.topicId, b.createdAt);
    }
    const neverBlurted = state.topics.find((t) => !lastBlurtByTopic.has(t.id));
    const weakest = [...m.mastery].filter((x) => x.retention !== null).sort((a, b) => (a.retention ?? 1) - (b.retention ?? 1))[0];
    const blurtTarget = neverBlurted ?? weakest?.topic;
    if (blurtTarget) {
      out.push({
        icon: Brain,
        title: `Blurt “${blurtTarget.title}”`,
        body: neverBlurted ? 'You haven’t done a free-recall dump on this yet.' : 'Your weakest retention right now — dump what you remember.',
        action: () => navigate('gym', blurtTarget.id),
        cta: '3-min blurt'
      });
    }
    const openGaps = state.drafts.flatMap((d) => d.gaps.filter((g) => !g.cardId).map((g) => ({ g, d })));
    if (openGaps.length) {
      out.push({
        icon: Lightbulb,
        title: `${openGaps.length} knowledge gap${openGaps.length > 1 ? 's' : ''} logged`,
        body: `“${openGaps[0].g.text.slice(0, 80)}${openGaps[0].g.text.length > 80 ? '…' : ''}” — turn friction into a study card.`,
        action: () => navigate('feynman', openGaps[0].d.topicId),
        cta: 'Review gaps'
      });
    } else if (state.topics.length) {
      const noDraft = state.topics.find((t) => !state.drafts.some((d) => d.topicId === t.id)) ?? state.topics[0];
      out.push({
        icon: Lightbulb,
        title: `Explain “${noDraft.title}” to a 10-year-old`,
        body: 'Plain-language explanations expose what you don’t really understand.',
        action: () => navigate('feynman', noDraft.id),
        cta: 'Open studio'
      });
    }
    if (state.topics.length >= 2) {
      out.push({
        icon: GitMerge,
        title: 'Build a cross-domain bridge',
        body: 'Answer one elaborative question linking two fields you’re studying.',
        action: () => navigate('synthesis'),
        cta: 'Generate'
      });
    }
    return out;
  }, [state, m.mastery, navigate]);

  const calGap = m.cal?.gap ?? null;
  const calLabel =
    calGap === null
      ? 'No data yet'
      : Math.abs(calGap) < 0.05
        ? 'Well calibrated'
        : calGap > 0
          ? `Overconfident by ${Math.round(calGap * 100)} pts`
          : `Underconfident by ${Math.round(-calGap * 100)} pts`;

  return (
    <div className="animate-rise-in">
      <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow mb-2">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1 className="display text-[36px] leading-[1.08] md:text-[46px]">
            {greeting(now)}.
            <br />
            <span className="text-muted">
              {dueNow > 0 ? (
                <>
                  <span className="text-ink">{dueNow} idea{dueNow === 1 ? '' : 's'}</span> are ready to be recalled.
                </>
              ) : (
                <>Your memory is up to date.</>
              )}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => window.dispatchEvent(new CustomEvent('synapse:capture'))} icon={<Plus size={16} />}>
            Capture <Kbd className="ml-1">{modKeyLabel} K</Kbd>
          </Button>
          <Button variant="primary" size="lg" onClick={() => navigate('review')} icon={<Layers size={17} />} trailing={<ArrowRight size={16} />}>
            {m.deck.length ? `Start deck · ${m.deck.length}` : 'Open deck'}
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card relative overflow-hidden p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Streak</p>
            <Flame size={16} className={m.s.practicedToday ? 'text-warn' : 'text-faint'} />
          </div>
          <p className="display mt-3 text-5xl tabular-nums">
            {m.s.current}
            <span className="ml-1.5 font-sans text-base text-muted">day{m.s.current === 1 ? '' : 's'}</span>
          </p>
          <p className="mt-2 text-[13px] text-muted">
            {m.s.practicedToday ? 'Practiced today ✓' : 'Practice today to extend it'} · best {m.s.longest}
          </p>
          <div className="mt-4 flex gap-1">
            {m.act.slice(-7).map((d) => (
              <div key={d.key} className={`h-1.5 flex-1 rounded-full ${d.reviews + d.other > 0 ? 'bg-warn' : 'bg-line'}`} />
            ))}
          </div>
        </div>

        <div className="card flex items-center gap-5 p-5">
          <ProgressRing value={m.ret ?? 0} tone={m.ret === null ? 'accent' : m.ret >= 0.85 ? 'good' : m.ret >= 0.7 ? 'warn' : 'bad'}>
            <span className="font-display text-xl tabular-nums">{pct(m.ret)}</span>
          </ProgressRing>
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <Activity size={12} /> Retention health
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Predicted recall across all cards today, from each card’s forgetting curve.
            </p>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Retrieval accuracy</p>
            <Target size={16} className="text-faint" />
          </div>
          <p className="display mt-3 text-5xl tabular-nums">{pct(m.acc)}</p>
          <p className="mt-1 text-[13px] text-muted">last 30 days · {m.reviewedToday} reviewed today</p>
          <div className="mt-3">
            <Sparkline values={m.daily14} />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Metacognition</p>
            <Gauge size={16} className="text-faint" />
          </div>
          <p className="display mt-3 text-[26px] leading-tight">{calLabel}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {m.cal
              ? `Stated confidence ${pct(m.cal.confidence)} vs. actual ${pct(m.cal.accuracy)} · Brier ${m.cal.brier.toFixed(2)}`
              : 'Rate confidence before each reveal to train calibration.'}
          </p>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="card p-6 lg:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="eyebrow">Upcoming spaced reviews</p>
              <p className="mt-1 text-sm text-muted">
                {m.fc[0].count} due today{deckTopics > 1 ? ` across ${deckTopics} topics, interleaved` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="eyebrow mb-1.5">Leitner boxes</p>
              <div className="flex items-end gap-1">
                {m.boxes.map((n, i) => (
                  <div key={i} className="flex flex-col items-center gap-1" title={`Box ${i + 1}: ${n} cards`}>
                    <div className="w-5 rounded-sm bg-accent" style={{ height: 4 + n * 3, opacity: 0.3 + i * 0.17 }} />
                    <span className="font-mono text-[9.5px] text-faint">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ForecastBars data={m.fc} />
        </div>

        <div className="card p-6 lg:col-span-2">
          <p className="eyebrow">Calibration curve</p>
          <div className="mt-4 flex items-center gap-5">
            {m.cal ? <CalibrationChart cal={m.cal} /> : <div className="h-[150px] w-[150px] rounded-lg border border-dashed border-line" />}
            <p className="text-[13px] leading-relaxed text-muted">
              Dots on the dashed line mean your confidence matches reality. Dots <b className="font-medium text-ink">below</b> it reveal the
              illusion of competence — you felt surer than you were.
            </p>
          </div>
          <div className="mt-5">
            <p className="eyebrow mb-2">Last 4 weeks</p>
            <ActivityStrip data={m.act} />
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="card p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">Topic mastery</p>
            <button onClick={() => navigate('topics')} className="text-[13px] text-muted transition hover:text-ink">
              All topics →
            </button>
          </div>
          <ul className="divide-y divide-line">
            {m.mastery.map(({ topic, cards, due, retention, avgBox }) => (
              <li key={topic.id}>
                <button onClick={() => navigate('topics', topic.id)} className="group flex w-full items-center gap-4 py-3.5 text-left">
                  <DomainDot domain={topic.domain} size={10} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium group-hover:text-accent">{topic.title}</p>
                    <p className="text-[12.5px] text-muted">
                      {cards} cards · avg box {avgBox.toFixed(1)} {due > 0 && <span className="text-accent">· {due} due</span>}
                    </p>
                  </div>
                  <div className="hidden w-40 sm:block">
                    <div className="h-1.5 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${retention === null ? '' : retention >= 0.85 ? 'bg-good' : retention >= 0.7 ? 'bg-warn' : 'bg-bad'}`}
                        style={{ width: `${Math.round((retention ?? 0) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-11 text-right font-mono text-[13px] tabular-nums text-muted">{pct(retention)}</span>
                </button>
              </li>
            ))}
            {!m.mastery.length && <li className="py-6 text-sm text-muted">No topics yet — add one to get started.</li>}
          </ul>
        </div>

        <div className="card p-6 lg:col-span-2">
          <p className="eyebrow mb-4">Suggested next moves</p>
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li key={s.title} className="rounded-xl border border-line bg-canvas/40 p-4 transition hover:border-faint">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <s.icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{s.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.body}</p>
                    <button onClick={s.action} className="mt-2 text-[13px] font-medium text-accent hover:underline">
                      {s.cta} →
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {[...new Set(state.topics.map((t) => t.domain))].map((d) => (
              <DomainChip key={d} domain={d} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
