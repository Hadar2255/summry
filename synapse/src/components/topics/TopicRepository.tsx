import { useMemo, useState } from 'react';
import { BookOpenText, Plus, Search, Network } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import { useNav } from '../../hooks/useNav';
import { retentionHealth } from '../../utils/metrics';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import { DomainChip } from '../ui/DomainChip';
import { EmptyState } from '../ui/EmptyState';
import { TopicEditor } from './TopicEditor';
import { TopicDetail } from './TopicDetail';
import { ConceptMap } from './ConceptMap';

export function TopicRepository() {
  const { state, topicById } = useStore();
  const { topicId, navigate } = useNav();
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const domains = useMemo(() => [...new Set(state.topics.map((t) => t.domain))].sort(), [state.topics]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.topics
      .filter((t) => !domain || t.domain === domain)
      .filter(
        (t) =>
          !q ||
          [t.title, t.domain, t.coreTenet, t.sourceSummary, ...t.tags, ...t.mentalModels.map((m) => m.name)]
            .join(' ')
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [state.topics, query, domain]);

  const selected = topicById(topicId);
  if (selected) return <TopicDetail topic={selected} />;

  const now = new Date();

  return (
    <div className="animate-rise-in">
      <PageHeader
        eyebrow="Repository"
        title="Topics & mental models"
        description="Every idea you’re learning, its core tenet, the thinking tools it gives you, and the bridges it builds to other fields."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditorOpen(true)}>
            New topic
          </Button>
        }
      />

      {state.topics.length === 0 ? (
        <EmptyState
          icon={<BookOpenText size={22} />}
          title="Your repository is empty"
          body="Add your first topic — any domain works. Synapse will turn it into recall practice."
          action={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditorOpen(true)}>
              Add a topic
            </Button>
          }
        />
      ) : (
        <>
          <div className="card mb-6 p-5">
            <p className="eyebrow mb-1 flex items-center gap-1.5">
              <Network size={12} /> Concept map
            </p>
            <ConceptMap topics={state.topics} onSelect={(id) => navigate('topics', id)} />
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input className="input pl-10" placeholder="Search topics, tags, mental models…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setDomain(null)}
                className={`rounded-full border px-3 py-1 text-[12.5px] transition ${!domain ? 'border-ink bg-ink text-canvas' : 'border-line text-muted hover:text-ink'}`}
              >
                All
              </button>
              {domains.map((d) => (
                <button key={d} onClick={() => setDomain(domain === d ? null : d)} className={`transition ${domain && domain !== d ? 'opacity-50' : ''}`}>
                  <DomainChip domain={d} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => {
              const cards = state.cards.filter((c) => c.topicId === t.id);
              const due = cards.filter((c) => !c.suspended && new Date(c.srs.due) <= now).length;
              const ret = retentionHealth(cards, now);
              return (
                <button
                  key={t.id}
                  onClick={() => navigate('topics', t.id)}
                  className="card group flex flex-col p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-faint hover:shadow-xl hover:shadow-black/5"
                >
                  <div className="flex items-center justify-between">
                    <DomainChip domain={t.domain} />
                    {due > 0 && <span className="font-mono text-[11px] text-accent">{due} due</span>}
                  </div>
                  <h3 className="display mt-4 text-[23px] leading-tight group-hover:text-accent">{t.title}</h3>
                  <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted">{t.coreTenet}</p>
                  <div className="mt-auto flex items-center gap-3 pt-5 text-[12px] text-faint">
                    <span>{cards.length} cards</span>
                    <span>·</span>
                    <span>{t.mentalModels.length} models</span>
                    <span>·</span>
                    <span>{t.links.length} links</span>
                    <span className="ml-auto font-mono">{ret === null ? 'new' : `${Math.round(ret * 100)}%`}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {!filtered.length && <p className="py-10 text-center text-sm text-muted">No topics match.</p>}
        </>
      )}

      <TopicEditor open={editorOpen} onClose={() => setEditorOpen(false)} onSaved={(t) => navigate('topics', t.id)} />
    </div>
  );
}
