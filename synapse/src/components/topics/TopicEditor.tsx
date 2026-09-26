import { useEffect, useState } from 'react';
import { Plus, Trash2, Link2 } from 'lucide-react';
import type { CrossDomainLink, MentalModel, Topic } from '../../types';
import { useStore } from '../../hooks/useStore';
import { uid } from '../../utils/id';
import { DOMAIN_SUGGESTIONS } from '../../utils/domain';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

function blankTopic(title = ''): Topic {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title,
    domain: '',
    coreTenet: '',
    sourceSummary: '',
    source: '',
    mentalModels: [],
    tags: [],
    links: [],
    createdAt: now,
    updatedAt: now
  };
}

export function TopicEditor({
  open,
  onClose,
  topic,
  initialTitle,
  onSaved
}: {
  open: boolean;
  onClose: () => void;
  topic?: Topic | null;
  initialTitle?: string;
  onSaved?: (t: Topic) => void;
}) {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState<Topic>(() => topic ?? blankTopic(initialTitle));
  const [tagText, setTagText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = topic ?? blankTopic(initialTitle);
    setDraft(t);
    setTagText(t.tags.join(', '));
    setError(null);
    // Captured on open so edits aren't reset by unrelated re-renders.
  }, [open]);

  const set = <K extends keyof Topic>(k: K, v: Topic[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setModel = (id: string, patch: Partial<MentalModel>) =>
    set('mentalModels', draft.mentalModels.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const setLink = (id: string, patch: Partial<CrossDomainLink>) =>
    set('links', draft.links.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const domains = [...new Set([...state.topics.map((t) => t.domain), ...DOMAIN_SUGGESTIONS])].sort();
  const others = state.topics.filter((t) => t.id !== draft.id);

  const save = () => {
    if (!draft.title.trim()) return setError('Give the topic a title.');
    if (!draft.domain.trim()) return setError('Which field does this belong to? Add a domain.');
    if (!draft.coreTenet.trim()) return setError('State the core tenet — the one idea you must be able to recall.');
    const t: Topic = {
      ...draft,
      title: draft.title.trim(),
      domain: draft.domain.trim(),
      coreTenet: draft.coreTenet.trim(),
      sourceSummary: draft.sourceSummary.trim(),
      source: draft.source.trim(),
      tags: tagText
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      mentalModels: draft.mentalModels.filter((m) => m.name.trim()),
      links: draft.links.filter((l) => l.targetTopicId && others.some((o) => o.id === l.targetTopicId)),
      updatedAt: new Date().toISOString()
    };
    dispatch({ type: 'topic/upsert', topic: t });
    onSaved?.(t);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="lg"
      title={topic ? 'Edit topic' : 'New topic'}
      subtitle="Capture the idea, the models it gives you, and how it connects to other fields."
      footer={
        <>
          {error && <p className="mr-auto text-sm text-bad">{error}</p>}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {topic ? 'Save changes' : 'Create topic'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="eyebrow mb-1.5 block">Title</span>
            <input data-autofocus className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Occam's Razor" />
          </label>
          <label className="block">
            <span className="eyebrow mb-1.5 block">Domain</span>
            <input className="input" list="synapse-domains" value={draft.domain} onChange={(e) => set('domain', e.target.value)} placeholder="Philosophy" />
            <datalist id="synapse-domains">
              {domains.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="block">
          <span className="eyebrow mb-1.5 block">Core tenet / concept</span>
          <textarea
            className="textarea min-h-[72px] font-display text-[17px]"
            value={draft.coreTenet}
            onChange={(e) => set('coreTenet', e.target.value)}
            placeholder="The single idea, in one or two sentences."
          />
        </label>

        <label className="block">
          <span className="eyebrow mb-1.5 block">Source summary</span>
          <textarea
            className="textarea min-h-[130px]"
            value={draft.sourceSummary}
            onChange={(e) => set('sourceSummary', e.target.value)}
            placeholder="Your condensed notes. This is the master copy used when grading blurts."
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow mb-1.5 block">Source</span>
            <input className="input" value={draft.source} onChange={(e) => set('source', e.target.value)} placeholder="Book, paper, lecture, URL…" />
          </label>
          <label className="block">
            <span className="eyebrow mb-1.5 block">Tags</span>
            <input className="input" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="comma, separated" />
          </label>
        </div>

        <fieldset>
          <div className="mb-2 flex items-center justify-between">
            <legend className="eyebrow">Key mental models</legend>
            <Button
              size="sm"
              variant="ghost"
              icon={<Plus size={14} />}
              onClick={() => set('mentalModels', [...draft.mentalModels, { id: uid(), name: '', description: '' }])}
            >
              Add model
            </Button>
          </div>
          <div className="space-y-2">
            {draft.mentalModels.map((m) => (
              <div key={m.id} className="flex gap-2">
                <input className="input w-1/3" value={m.name} onChange={(e) => setModel(m.id, { name: e.target.value })} placeholder="Name" />
                <input className="input flex-1" value={m.description} onChange={(e) => setModel(m.id, { description: e.target.value })} placeholder="What it lets you see" />
                <Button size="icon" variant="ghost" aria-label="Remove model" onClick={() => set('mentalModels', draft.mentalModels.filter((x) => x.id !== m.id))}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            {!draft.mentalModels.length && <p className="text-[13px] text-faint">Reusable thinking tools this topic gives you.</p>}
          </div>
        </fieldset>

        <fieldset>
          <div className="mb-2 flex items-center justify-between">
            <legend className="eyebrow">Cross-domain links</legend>
            <Button
              size="sm"
              variant="ghost"
              icon={<Link2 size={14} />}
              disabled={!others.length}
              onClick={() => set('links', [...draft.links, { id: uid(), targetTopicId: others[0]?.id ?? '', relation: '' }])}
            >
              Add link
            </Button>
          </div>
          <div className="space-y-2">
            {draft.links.map((l) => (
              <div key={l.id} className="flex gap-2">
                <select className="input w-1/3 cursor-pointer" value={l.targetTopicId} onChange={(e) => setLink(l.id, { targetTopicId: e.target.value })}>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} · {o.domain}
                    </option>
                  ))}
                </select>
                <input className="input flex-1" value={l.relation} onChange={(e) => setLink(l.id, { relation: e.target.value })} placeholder="How are they related?" />
                <Button size="icon" variant="ghost" aria-label="Remove link" onClick={() => set('links', draft.links.filter((x) => x.id !== l.id))}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            {!draft.links.length && (
              <p className="text-[13px] text-faint">{others.length ? 'Connect this idea to a concept from another field.' : 'Add more topics to link them together.'}</p>
            )}
          </div>
        </fieldset>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
