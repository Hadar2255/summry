import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, FilePlus2, History, Lightbulb, ScanText } from 'lucide-react';
import type { FeynmanDraft, ID, KnowledgeGap } from '../../types';
import { makeCard, makeGap, useStore } from '../../hooks/useStore';
import { useNav } from '../../hooks/useNav';
import { scanText, type ScanIssue } from '../../utils/jargon';
import { uid } from '../../utils/id';
import { shortDate } from '../../utils/date';
import { PageHeader } from '../ui/PageHeader';
import { TopicSelect } from '../ui/TopicSelect';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../ui/Toast';
import { HighlightedText, IssueList, Legend, ScoreCard } from './ScannerPanel';
import { GapHighlighter } from './GapHighlighter';

export function FeynmanStudio() {
  const { state, dispatch, topicById } = useStore();
  const { topicId: navTopic, navigate } = useNav();
  const toast = useToast();
  const [topicId, setTopicId] = useState<ID | null>(navTopic ?? state.topics[0]?.id ?? null);
  const [draftId, setDraftId] = useState<ID | null>(null);
  const [text, setText] = useState('');
  const [peek, setPeek] = useState(false);
  const [view, setView] = useState<'write' | 'scan'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const topic = topicById(topicId);
  const drafts = useMemo(
    () => state.drafts.filter((d) => d.topicId === topicId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.drafts, topicId]
  );
  const draft = state.drafts.find((d) => d.id === draftId) ?? null;

  useEffect(() => {
    if (navTopic && navTopic !== topicId && topicById(navTopic)) setTopicId(navTopic);
  }, [navTopic]);

  // Load the latest draft when switching topic.
  useEffect(() => {
    const latest = state.drafts
      .filter((d) => d.topicId === topicId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    setDraftId(latest?.id ?? null);
    setText(latest?.explanation ?? '');
    setPeek(false);
  }, [topicId]);

  const scan = useMemo(() => scanText(text), [text]);

  const persist = (patch: Partial<FeynmanDraft>): ID | null => {
    if (!topicId) return null;
    const now = new Date().toISOString();
    const base: FeynmanDraft =
      draft ?? {
        id: draftId ?? uid(),
        topicId,
        explanation: '',
        gaps: [],
        clarityScore: 0,
        readingGrade: 0,
        createdAt: now,
        updatedAt: now
      };
    const next = { ...base, ...patch, updatedAt: now };
    dispatch({ type: 'draft/upsert', draft: next });
    if (!draftId) setDraftId(next.id);
    return next.id;
  };

  // Debounced autosave of the explanation + score.
  useEffect(() => {
    if (!topicId) return;
    if ((draft?.explanation ?? '') === text) return;
    if (!draft && !text.trim()) return;
    const t = window.setTimeout(() => {
      persist({ explanation: text, clarityScore: scan.clarityScore, readingGrade: scan.readingGrade });
    }, 600);
    return () => window.clearTimeout(t);
  }, [text, topicId, draft?.explanation]);

  const pickIssue = (i: ScanIssue) => {
    setView('write');
    window.setTimeout(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(i.start, i.end);
    }, 30);
  };

  const gaps = draft?.gaps ?? [];
  const addGap = (t: string) => persist({ gaps: [...gaps, makeGap(t)] });
  const removeGap = (id: string) => persist({ gaps: gaps.filter((g) => g.id !== id) });
  const convertGap = (gap: KnowledgeGap, prompt: string, answer: string) => {
    if (!topicId) return;
    const card = makeCard(topicId, prompt, answer, 'feynman-gap');
    dispatch({ type: 'card/add', card });
    persist({ gaps: gaps.map((g) => (g.id === gap.id ? { ...g, cardId: card.id } : g)) });
    toast('Gap turned into a card — it’s due now');
  };

  const newVersion = () => {
    const id = uid();
    const now = new Date().toISOString();
    if (!topicId) return;
    dispatch({
      type: 'draft/upsert',
      draft: { id, topicId, explanation: '', gaps: [], clarityScore: 0, readingGrade: 0, createdAt: now, updatedAt: now }
    });
    setDraftId(id);
    setText('');
    textareaRef.current?.focus();
  };

  if (!state.topics.length) {
    return (
      <EmptyState
        icon={<Lightbulb size={22} />}
        title="Nothing to explain yet"
        body="Add a topic to the repository first, then come back to explain it in plain words."
        action={<Button onClick={() => navigate('topics')}>Go to topics</Button>}
      />
    );
  }

  return (
    <div className="animate-rise-in">
      <PageHeader
        eyebrow="The Feynman technique"
        title="Feynman Studio"
        description="If you can’t explain it simply, you don’t understand it well enough. Write for a curious 10-year-old; the scanner flags where you retreat into jargon."
        actions={<TopicSelect topics={state.topics} value={topicId} onChange={setTopicId} className="min-w-[240px]" />}
      />

      {topic && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div className="flex rounded-lg bg-raised p-0.5 text-[13px]">
                  {(['write', 'scan'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${view === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                    >
                      {v === 'write' ? <Lightbulb size={14} /> : <ScanText size={14} />}
                      {v === 'write' ? 'Explain' : 'Scanner view'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" icon={peek ? <EyeOff size={14} /> : <Eye size={14} />} onClick={() => setPeek((p) => !p)}>
                    {peek ? 'Hide notes' : 'Peek at notes'}
                  </Button>
                  <Button size="sm" variant="ghost" icon={<FilePlus2 size={14} />} onClick={newVersion} disabled={!text.trim()}>
                    New version
                  </Button>
                </div>
              </div>

              <div className="px-6 pb-6 pt-5">
                <p className="display text-[22px] leading-snug">
                  Explain <span className="text-accent">{topic.title}</span> like you’re talking to a 10-year-old.
                </p>
                <p className="mt-1.5 text-[13px] text-muted">Use short sentences, everyday words, and at least one concrete example or analogy.</p>

                {peek && (
                  <div className="mt-4 rounded-xl border border-warn/30 bg-warn/5 p-4 text-[13.5px] leading-relaxed animate-fade-in">
                    <p className="eyebrow mb-1.5 !text-warn">Peeking weakens retrieval — glance, then hide</p>
                    {topic.coreTenet}
                  </div>
                )}

                {view === 'write' ? (
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Imagine a lemonade stand…"
                    spellCheck
                    className="mt-5 min-h-[300px] w-full resize-y bg-transparent font-display text-[19px] leading-[1.7] text-ink placeholder:text-faint focus:outline-none"
                  />
                ) : (
                  <div className="mt-5 min-h-[300px]">
                    <HighlightedText text={text} issues={scan.issues} />
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <Legend />
                  <span className="font-mono text-[11px] text-faint">
                    {scan.words} words · {scan.sentences} sentences
                  </span>
                </div>
              </div>
            </section>

            <GapHighlighter gaps={gaps} onAdd={addGap} onRemove={removeGap} onConvert={convertGap} />
          </div>

          <aside className="space-y-5">
            <ScoreCard scan={scan} />
            <section className="card p-3">
              <p className="eyebrow px-3 pb-1 pt-2">Jargon & complexity scanner</p>
              <IssueList issues={scan.issues} onPick={pickIssue} />
            </section>
            {drafts.length > 0 && (
              <section className="card p-5">
                <p className="eyebrow mb-3 flex items-center gap-1.5">
                  <History size={12} /> Versions
                </p>
                <ul className="space-y-1">
                  {drafts.map((d) => (
                    <li key={d.id}>
                      <button
                        onClick={() => {
                          setDraftId(d.id);
                          setText(d.explanation);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition hover:bg-raised ${d.id === draftId ? 'bg-raised' : ''}`}
                      >
                        <span className="text-muted">{shortDate(d.updatedAt)}</span>
                        <span className="text-faint">{d.gaps.length} gaps</span>
                        <span className={`font-mono tabular-nums ${d.clarityScore >= 80 ? 'text-good' : d.clarityScore >= 55 ? 'text-warn' : 'text-bad'}`}>
                          {d.explanation.trim() ? d.clarityScore : '–'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
