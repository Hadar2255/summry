import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Brain, CornerDownLeft, FilePlus2, Layers, Lightbulb, Moon, Plus, Search, Sparkles, BookOpenText } from 'lucide-react';
import { makeCard, useStore } from '../../hooks/useStore';
import { useNav } from '../../hooks/useNav';
import { Modal } from '../ui/Modal';
import { Kbd } from '../ui/Kbd';
import { TopicSelect } from '../ui/TopicSelect';
import { useToast } from '../ui/Toast';
import { NAV_ITEMS } from '../layout/navItems';
import type { ID, Topic } from '../../types';

interface PaletteItem {
  id: string;
  group: string;
  label: ReactNode;
  hint?: string;
  icon: ReactNode;
  keywords: string;
  run: () => void;
}

const LAST_TOPIC_KEY = 'synapse:capture-topic';

/**
 * Cmd/Ctrl+K quick capture & command palette.
 * - "Question :: Answer" → instantly creates a card in the selected topic.
 * - Anything else filters commands (navigate, start sessions, open topics) or creates a new topic.
 */
export function CommandPalette({ open, onClose, onNewTopic }: { open: boolean; onClose: () => void; onNewTopic: (title: string) => void }) {
  const { state, dispatch } = useStore();
  const { navigate } = useNav();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [topicId, setTopicId] = useState<ID | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(LAST_TOPIC_KEY);
    } catch {
      saved = null;
    }
    const fallback = state.topics[0]?.id ?? null;
    setTopicId(state.topics.some((t) => t.id === saved) ? saved : fallback);
  }, [open]);

  const isCard = query.includes('::');
  const [q, a] = isCard ? query.split('::').map((s) => s.trim()) : [query.trim(), ''];
  const topic = state.topics.find((t) => t.id === topicId);

  const close = () => {
    onClose();
  };

  const go = (fn: () => void) => () => {
    fn();
    close();
  };

  const items = useMemo<PaletteItem[]>(() => {
    const topicItems = (t: Topic): PaletteItem[] => [
      {
        id: `open-${t.id}`,
        group: 'Topics',
        label: (
          <>
            Open <b className="font-medium">{t.title}</b>
          </>
        ),
        hint: t.domain,
        icon: <BookOpenText size={16} />,
        keywords: `open topic ${t.title} ${t.domain} ${t.tags.join(' ')}`,
        run: go(() => navigate('topics', t.id))
      },
      {
        id: `blurt-${t.id}`,
        group: 'Practice',
        label: (
          <>
            Blurt <b className="font-medium">{t.title}</b>
          </>
        ),
        hint: 'Retrieval Gym',
        icon: <Brain size={16} />,
        keywords: `blurt recall gym ${t.title}`,
        run: go(() => navigate('gym', t.id))
      },
      {
        id: `feynman-${t.id}`,
        group: 'Practice',
        label: (
          <>
            Explain <b className="font-medium">{t.title}</b> simply
          </>
        ),
        hint: 'Feynman Studio',
        icon: <Lightbulb size={16} />,
        keywords: `feynman explain simple ${t.title}`,
        run: go(() => navigate('feynman', t.id))
      }
    ];

    const base: PaletteItem[] = [
      {
        id: 'start-deck',
        group: 'Practice',
        label: 'Start today’s interleaved deck',
        hint: 'Daily Deck',
        icon: <Layers size={16} />,
        keywords: 'start review deck spaced repetition interleave daily',
        run: go(() => navigate('review'))
      },
      {
        id: 'synth',
        group: 'Practice',
        label: 'Generate a cross-domain question',
        hint: 'Synthesis Bridge',
        icon: <Sparkles size={16} />,
        keywords: 'synthesis elaborate bridge question prompt',
        run: go(() => navigate('synthesis'))
      },
      ...NAV_ITEMS.map((n) => ({
        id: `nav-${n.view}`,
        group: 'Go to',
        label: n.label,
        hint: `g ${n.chord}`,
        icon: <n.icon size={16} />,
        keywords: `go navigate ${n.label} ${n.view}`,
        run: go(() => navigate(n.view))
      })),
      {
        id: 'theme',
        group: 'Preferences',
        label: 'Toggle dark / light mode',
        icon: <Moon size={16} />,
        keywords: 'theme dark light mode toggle',
        run: go(() => {
          const dark = document.documentElement.classList.contains('dark');
          dispatch({ type: 'settings/update', patch: { theme: dark ? 'light' : 'dark' } });
        })
      },
      ...state.topics.flatMap(topicItems)
    ];

    const needle = q.toLowerCase();
    const filtered = needle
      ? base.filter((i) => needle.split(/\s+/).every((w) => i.keywords.toLowerCase().includes(w)))
      : base.filter((i) => i.group !== 'Topics' || state.topics.length <= 4).slice(0, 12);

    if (needle && !isCard) {
      filtered.push({
        id: 'new-topic',
        group: 'Create',
        label: (
          <>
            New topic “<b className="font-medium">{q}</b>”
          </>
        ),
        icon: <FilePlus2 size={16} />,
        keywords: '',
        run: go(() => onNewTopic(q))
      });
    }
    return filtered;
  }, [q, isCard, state.topics, navigate, dispatch]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const createCard = () => {
    if (!topic || !q || !a) return;
    dispatch({ type: 'card/add', card: makeCard(topic.id, q, a, 'quick-capture') });
    try {
      localStorage.setItem(LAST_TOPIC_KEY, topic.id);
    } catch {
      // ignore
    }
    toast(`Card added to ${topic.title} — due now`);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isCard) {
      if (e.key === 'Enter') {
        e.preventDefault();
        createCard();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    }
  };

  let lastGroup = '';

  return (
    <Modal open={open} onClose={close} width="md" top hideClose>
      <div className="-mx-6 -my-5">
        <div className="flex items-center gap-3 border-b border-line px-5">
          {isCard ? <Plus size={18} className="text-accent" /> : <Search size={18} className="text-muted" />}
          <input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search, jump, or capture a card as “Question :: Answer”"
            className="h-14 flex-1 bg-transparent text-[15.5px] text-ink placeholder:text-faint focus:outline-none"
            aria-label="Command or capture"
          />
          <Kbd>Esc</Kbd>
        </div>

        {isCard ? (
          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-canvas/50 p-3.5">
                <p className="eyebrow mb-1.5">Prompt</p>
                <p className="text-[14.5px] leading-snug">{q || <span className="text-faint">Type a question…</span>}</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas/50 p-3.5">
                <p className="eyebrow mb-1.5">Answer</p>
                <p className="text-[14.5px] leading-snug">{a || <span className="text-faint">…then the answer after ::</span>}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TopicSelect topics={state.topics} value={topicId} onChange={setTopicId} className="sm:max-w-xs" />
              <button
                onClick={createCard}
                disabled={!topic || !q || !a}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-40"
              >
                Add card <CornerDownLeft size={14} />
              </button>
            </div>
            {!state.topics.length && <p className="text-sm text-warn">Create a topic first — cards live inside topics.</p>}
          </div>
        ) : (
          <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2" role="listbox">
            {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">No matches.</p>}
            {items.map((item, idx) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {header && <p className="eyebrow px-3 pb-1.5 pt-3">{header}</p>}
                  <button
                    data-index={idx}
                    role="option"
                    aria-selected={idx === active}
                    onMouseMove={() => setActive(idx)}
                    onClick={item.run}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition ${
                      idx === active ? 'bg-raised text-ink' : 'text-muted'
                    }`}
                  >
                    <span className={idx === active ? 'text-accent' : ''}>{item.icon}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.hint && <span className="font-mono text-[11px] text-faint">{item.hint}</span>}
                    {idx === active && <ArrowRight size={14} className="text-faint" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 border-t border-line px-5 py-2.5 text-[11.5px] text-faint">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> {isCard ? 'add card' : 'run'}
          </span>
          <span className="ml-auto font-mono">Q :: A → new card</span>
        </div>
      </div>
    </Modal>
  );
}
