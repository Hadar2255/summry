import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Dices, GitMerge, Save, Sparkles, Trash2, Layers } from 'lucide-react';
import type { ID, SynthesisKind } from '../../types';
import { makeCard, useStore } from '../../hooks/useStore';
import { useNav } from '../../hooks/useNav';
import { modKeyLabel, useHotkeys } from '../../hooks/useHotkeys';
import { ALL_KINDS, KIND_META, generatePrompt, type GeneratedPrompt } from '../../utils/prompts';
import { uid } from '../../utils/id';
import { relativeDay } from '../../utils/date';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { DomainChip } from '../ui/DomainChip';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../ui/Toast';

export function SynthesisBridge() {
  const { state, dispatch, topicById } = useStore();
  const { topicId: navTopic, navigate } = useNav();
  const toast = useToast();
  const [kind, setKind] = useState<SynthesisKind | null>(null);
  const [anchor, setAnchor] = useState<ID | null>(navTopic ?? null);
  const [prompt, setPrompt] = useState<GeneratedPrompt | null>(null);
  const [response, setResponse] = useState('');
  const [spin, setSpin] = useState(0);

  const regenerate = useCallback(() => {
    setPrompt(generatePrompt(state.topics, { kind: kind ?? undefined, anchorTopicId: anchor }));
    setResponse('');
    setSpin((s) => s + 1);
  }, [state.topics, kind, anchor]);

  useEffect(() => {
    if (navTopic) setAnchor(navTopic);
  }, [navTopic]);

  useEffect(() => {
    regenerate();
    // Regenerate when the filters change; topics editing elsewhere shouldn't reroll the prompt.
  }, [kind, anchor]);

  const save = (asCard: boolean) => {
    if (!prompt || !response.trim()) return;
    let cardId: ID | null = null;
    if (asCard) {
      const card = makeCard(prompt.topicIds[0], prompt.question, response, 'synthesis');
      cardId = card.id;
      dispatch({ type: 'card/add', card });
    }
    dispatch({
      type: 'synthesis/add',
      entry: {
        id: uid(),
        kind: prompt.kind,
        question: prompt.question,
        topicIds: prompt.topicIds,
        response: response.trim(),
        createdAt: new Date().toISOString(),
        cardId
      }
    });
    toast(asCard ? 'Saved and added to your deck' : 'Synthesis saved');
    regenerate();
  };

  useHotkeys([
    { combo: 'n', handler: regenerate },
    { combo: 'mod+shift+enter', handler: () => save(true), allowInInput: true },
    { combo: 'mod+enter', handler: () => save(false), allowInInput: true }
  ]);

  const history = useMemo(() => [...state.syntheses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.syntheses]);

  if (state.topics.length < 1) {
    return (
      <EmptyState
        icon={<GitMerge size={22} />}
        title="Nothing to connect yet"
        body="Elaborative synthesis needs ideas to work with. Add topics from at least two different fields."
        action={<Button onClick={() => navigate('topics')}>Go to topics</Button>}
      />
    );
  }

  const [a, b] = prompt?.concepts ?? [];

  return (
    <div className="animate-rise-in">
      <PageHeader
        eyebrow="Elaborative interrogation"
        title="Synthesis Bridge"
        description="Understanding deepens when you ask why, find the edges, and connect ideas across fields. Answer one analytical prompt at a time."
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setKind(null)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${kind === null ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:text-ink'}`}
          >
            Any type
          </button>
          {ALL_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(kind === k ? null : k)}
              title={KIND_META[k].blurb}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${kind === k ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'}`}
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>
        <select className="input max-w-[260px] cursor-pointer" value={anchor ?? ''} onChange={(e) => setAnchor(e.target.value || null)}>
          <option value="">Anchor: any topic</option>
          {state.topics.map((t) => (
            <option key={t.id} value={t.id}>
              Anchor: {t.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card relative overflow-hidden">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          {prompt && (
            <div key={spin} className="relative p-7 md:p-9 animate-flip-in">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-accent/10 px-3 py-1 text-[12px] font-medium text-accent">{KIND_META[prompt.kind].label}</span>
                <Button size="sm" variant="ghost" icon={<Dices size={15} />} onClick={regenerate} trailing={<Kbd className="ml-1">N</Kbd>}>
                  New prompt
                </Button>
              </div>

              {a && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button onClick={() => navigate('topics', a.topicId)} className="rounded-xl border border-line bg-canvas/50 px-3.5 py-2 text-left transition hover:border-faint">
                    <span className="block text-[13.5px] font-medium">{a.label}</span>
                    <DomainChip domain={a.domain} className="mt-1" />
                  </button>
                  {b && (
                    <>
                      <ArrowLeftRight size={16} className="text-faint" />
                      <button onClick={() => navigate('topics', b.topicId)} className="rounded-xl border border-line bg-canvas/50 px-3.5 py-2 text-left transition hover:border-faint">
                        <span className="block text-[13.5px] font-medium">{b.label}</span>
                        <DomainChip domain={b.domain} className="mt-1" />
                      </button>
                    </>
                  )}
                </div>
              )}

              <h2 className="display mt-7 text-[27px] leading-snug md:text-[32px]">{prompt.question}</h2>

              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Think out loud. Mechanisms, examples, edge cases, where the analogy breaks…"
                className="textarea mt-7 min-h-[200px] bg-surface/80 text-[15.5px]"
              />

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Button variant="secondary" icon={<Save size={15} />} disabled={!response.trim()} onClick={() => save(false)}>
                  Save <span className="kbd-hint ml-1 font-mono text-[11px] text-faint">{modKeyLabel}↵</span>
                </Button>
                <Button variant="primary" icon={<Layers size={15} />} disabled={!response.trim()} onClick={() => save(true)}>
                  Save as card <span className="kbd-hint ml-1 font-mono text-[11px] opacity-70">⇧{modKeyLabel}↵</span>
                </Button>
              </div>
            </div>
          )}
        </section>

        <aside className="card p-5">
          <p className="eyebrow mb-3 flex items-center gap-1.5">
            <Sparkles size={12} /> Your bridges
          </p>
          <ul className="space-y-3">
            {history.map((s) => (
              <li key={s.id} className="group rounded-xl border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-accent">{KIND_META[s.kind]?.label ?? s.kind}</span>
                  <span className="flex items-center gap-2 text-[11.5px] text-faint">
                    {relativeDay(s.createdAt)}
                    <button
                      onClick={() => dispatch({ type: 'synthesis/delete', id: s.id })}
                      className="touch-visible -m-2 p-2 opacity-0 transition hover:text-bad group-hover:opacity-100"
                      aria-label="Delete bridge"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
                <p className="mt-2 text-[13.5px] font-medium leading-snug">{s.question}</p>
                <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-muted">{s.response}</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {s.topicIds.map((id) => {
                    const t = topicById(id);
                    return t ? <DomainChip key={id} domain={t.domain} /> : null;
                  })}
                  {s.cardId && <span className="rounded-full bg-good/10 px-2 py-0.5 text-[11px] text-good">in deck</span>}
                </div>
              </li>
            ))}
            {!history.length && <li className="text-[13px] text-muted">Saved answers appear here.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
