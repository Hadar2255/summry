import { useState } from 'react';
import { ArrowLeft, Brain, Edit3, GitMerge, Lightbulb, MoreHorizontal, Pause, Play, Plus, RotateCcw, Trash2, ArrowUpRight, Quote } from 'lucide-react';
import type { Card, Topic } from '../../types';
import { useStore } from '../../hooks/useStore';
import { useNav } from '../../hooks/useNav';
import { formatInterval, relativeDay } from '../../utils/date';
import { retrievability } from '../../utils/srs';
import { Button } from '../ui/Button';
import { DomainChip } from '../ui/DomainChip';
import { Modal } from '../ui/Modal';
import { TopicEditor } from './TopicEditor';
import { CardEditor } from './CardEditor';

const ORIGIN_LABEL: Record<Card['origin'], string> = {
  seed: 'demo',
  manual: 'manual',
  'feynman-gap': 'gap',
  'blurt-miss': 'blurt',
  synthesis: 'bridge',
  'quick-capture': 'capture'
};

export function TopicDetail({ topic }: { topic: Topic }) {
  const { state, dispatch, topicById } = useStore();
  const { navigate } = useNav();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cardEditor, setCardEditor] = useState<{ open: boolean; card: Card | null }>({ open: false, card: null });
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const cards = state.cards.filter((c) => c.topicId === topic.id).sort((a, b) => a.srs.due.localeCompare(b.srs.due));
  const backlinks = state.topics.filter((t) => t.id !== topic.id && t.links.some((l) => l.targetTopicId === topic.id));
  const now = new Date();

  return (
    <div className="animate-rise-in">
      <button onClick={() => navigate('topics')} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink">
        <ArrowLeft size={15} /> All topics
      </button>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <DomainChip domain={topic.domain} />
          {topic.tags.map((t) => (
            <span key={t} className="rounded-full bg-raised px-2.5 py-0.5 font-mono text-[11px] text-muted">
              #{t}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="display text-[40px] leading-[1.05] md:text-[52px]">{topic.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" icon={<Brain size={15} />} onClick={() => navigate('gym', topic.id)}>
              Blurt
            </Button>
            <Button variant="soft" icon={<Lightbulb size={15} />} onClick={() => navigate('feynman', topic.id)}>
              Feynman
            </Button>
            <Button variant="soft" icon={<GitMerge size={15} />} onClick={() => navigate('synthesis', topic.id)}>
              Bridge
            </Button>
            <Button variant="ghost" size="icon" aria-label="Edit topic" onClick={() => setEditing(true)}>
              <Edit3 size={16} />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Delete topic" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card relative overflow-hidden p-7">
            <Quote size={64} className="absolute -right-2 -top-3 text-accent/10" />
            <p className="eyebrow mb-3">Core tenet</p>
            <p className="display text-[24px] leading-snug md:text-[27px]">{topic.coreTenet}</p>
          </section>

          <section className="card p-7">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">Source summary</p>
              {topic.source && <span className="truncate pl-4 text-[12px] italic text-faint">{topic.source}</span>}
            </div>
            <p className="prose-synapse whitespace-pre-wrap">{topic.sourceSummary || <span className="text-faint">No summary yet.</span>}</p>
          </section>

          <section className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="eyebrow">Study cards</p>
                <p className="mt-1 text-[13px] text-muted">{cards.length} cards · sorted by next review</p>
              </div>
              <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setCardEditor({ open: true, card: null })}>
                Add card
              </Button>
            </div>
            <ul className="divide-y divide-line">
              {cards.map((c) => {
                const r = retrievability(c.srs, now);
                const due = new Date(c.srs.due) <= now;
                return (
                  <li key={c.id} className={`group flex items-start gap-4 py-3.5 ${c.suspended ? 'opacity-45' : ''}`}>
                    <div className="mt-1 flex gap-[3px]" title={`Leitner box ${c.srs.box}`}>
                      {[1, 2, 3, 4, 5].map((b) => (
                        <span key={b} className={`h-3 w-[3px] rounded-full ${b <= c.srs.box ? 'bg-accent' : 'bg-line'}`} />
                      ))}
                    </div>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setCardEditor({ open: true, card: c })}>
                      <p className="text-[14.5px] font-medium leading-snug">{c.prompt}</p>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{c.answer}</p>
                      <p className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10.5px] uppercase tracking-wide text-faint">
                        <span className={due && !c.suspended ? 'text-accent' : ''}>{c.suspended ? 'suspended' : due ? 'due now' : `due ${relativeDay(c.srs.due, now)}`}</span>
                        <span>ivl {formatInterval(c.srs.interval)}</span>
                        <span>ease {c.srs.ease.toFixed(2)}</span>
                        {r !== null && <span>recall {Math.round(r * 100)}%</span>}
                        <span>{ORIGIN_LABEL[c.origin]}</span>
                      </p>
                    </button>
                    <div className="relative">
                      <Button size="icon" variant="ghost" aria-label="Card actions" onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}>
                        <MoreHorizontal size={16} />
                      </Button>
                      {menuFor === c.id && (
                        <div className="card absolute right-0 top-10 z-20 w-44 p-1.5 shadow-xl animate-fade-in" onMouseLeave={() => setMenuFor(null)}>
                          {[
                            {
                              label: c.suspended ? 'Unsuspend' : 'Suspend',
                              icon: c.suspended ? Play : Pause,
                              run: () => dispatch({ type: 'card/update', id: c.id, patch: { suspended: !c.suspended } })
                            },
                            { label: 'Reset progress', icon: RotateCcw, run: () => dispatch({ type: 'card/reset', id: c.id }) },
                            { label: 'Delete', icon: Trash2, run: () => dispatch({ type: 'card/delete', id: c.id }) }
                          ].map((a) => (
                            <button
                              key={a.label}
                              onClick={() => {
                                a.run();
                                setMenuFor(null);
                              }}
                              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-raised ${a.label === 'Delete' ? 'text-bad' : ''}`}
                            >
                              <a.icon size={14} /> {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              {!cards.length && <li className="py-6 text-sm text-muted">No cards yet. Add a few questions that force you to retrieve this idea.</li>}
            </ul>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-6">
            <p className="eyebrow mb-4">Key mental models</p>
            <ul className="space-y-4">
              {topic.mentalModels.map((m, i) => (
                <li key={m.id} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="font-medium leading-snug">{m.name}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{m.description}</p>
                  </div>
                </li>
              ))}
              {!topic.mentalModels.length && <li className="text-sm text-faint">None yet.</li>}
            </ul>
          </section>

          <section className="card p-6">
            <p className="eyebrow mb-4">Cross-domain links</p>
            <ul className="space-y-3">
              {topic.links.map((l) => {
                const t = topicById(l.targetTopicId);
                if (!t) return null;
                return (
                  <li key={l.id}>
                    <button onClick={() => navigate('topics', t.id)} className="group w-full rounded-xl border border-line p-3.5 text-left transition hover:border-faint">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium group-hover:text-accent">{t.title}</span>
                        <ArrowUpRight size={14} className="text-faint" />
                      </div>
                      <DomainChip domain={t.domain} className="mt-1.5" />
                      {l.relation && <p className="mt-2 text-[13px] italic leading-relaxed text-muted">“{l.relation}”</p>}
                    </button>
                  </li>
                );
              })}
              {backlinks.map((t) => (
                <li key={`back-${t.id}`}>
                  <button onClick={() => navigate('topics', t.id)} className="w-full rounded-xl border border-dashed border-line p-3.5 text-left text-[13px] text-muted transition hover:border-faint hover:text-ink">
                    ← linked from <span className="font-medium text-ink">{t.title}</span>
                    <span className="mt-1 block italic">“{t.links.find((l) => l.targetTopicId === topic.id)?.relation}”</span>
                  </button>
                </li>
              ))}
              {!topic.links.length && !backlinks.length && <li className="text-sm text-faint">No links yet — edit the topic to connect it to another field.</li>}
            </ul>
          </section>
        </aside>
      </div>

      <TopicEditor open={editing} onClose={() => setEditing(false)} topic={topic} />
      <CardEditor open={cardEditor.open} card={cardEditor.card} topicId={topic.id} onClose={() => setCardEditor({ open: false, card: null })} />
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        width="sm"
        title={`Delete “${topic.title}”?`}
        subtitle="Its cards, review history, Feynman drafts, blurts and bridges will be removed. Export a backup first if unsure."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'topic/delete', id: topic.id });
                setConfirmDelete(false);
                navigate('topics');
              }}
            >
              Delete topic
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{cards.length} cards will be deleted.</p>
      </Modal>
    </div>
  );
}
