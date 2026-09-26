import { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'lucide-react';
import { useStore } from './hooks/useStore';
import { useNav } from './hooks/useNav';
import { useTheme } from './hooks/useTheme';
import { isTypingTarget, matches } from './hooks/useHotkeys';
import { buildDailyDeck } from './utils/interleave';
import type { View } from './types';
import { Sidebar, MobileNav, Logo } from './components/layout/Sidebar';
import { NAV_ITEMS } from './components/layout/navItems';
import { ShortcutsHelp } from './components/layout/ShortcutsHelp';
import { CommandPalette } from './components/capture/CommandPalette';
import { Dashboard } from './components/dashboard/Dashboard';
import { TopicRepository } from './components/topics/TopicRepository';
import { TopicEditor } from './components/topics/TopicEditor';
import { FeynmanStudio } from './components/feynman/FeynmanStudio';
import { RetrievalGym } from './components/gym/RetrievalGym';
import { ReviewSession } from './components/review/ReviewSession';
import { SynthesisBridge } from './components/synthesis/SynthesisBridge';
import { SettingsPanel } from './components/settings/SettingsPanel';

const VIEWS: Record<View, () => JSX.Element> = {
  dashboard: Dashboard,
  topics: TopicRepository,
  feynman: FeynmanStudio,
  gym: RetrievalGym,
  review: ReviewSession,
  synthesis: SynthesisBridge,
  settings: SettingsPanel
};

const CHORD_TO_VIEW = new Map(NAV_ITEMS.map((n) => [n.chord, n.view]));

export default function App() {
  const { state, ready } = useStore();
  const { view, topicId, navigate } = useNav();
  useTheme(state.settings.theme);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState<string | null>(null);
  const chordAt = useRef(0);

  const dueCount = useMemo(
    () =>
      buildDailyDeck(state.cards, state.topics, {
        now: new Date(),
        limit: state.settings.dailyReviewLimit,
        interleave: false,
        minTopics: 0
      }).length,
    [state.cards, state.topics, state.settings.dailyReviewLimit]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (matches(e, 'mod+k')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const overlayOpen = !!document.querySelector('[aria-modal="true"]');
      if (overlayOpen || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      const key = e.key.toLowerCase();
      if (Date.now() - chordAt.current < 1200) {
        chordAt.current = 0;
        const target = CHORD_TO_VIEW.get(key);
        if (target) {
          e.preventDefault();
          navigate(target);
        }
        return;
      }
      if (key === 'g') chordAt.current = Date.now();
    };
    const onCapture = () => setPaletteOpen(true);
    const onHelp = () => setHelpOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('synapse:capture', onCapture);
    window.addEventListener('synapse:shortcuts', onHelp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('synapse:capture', onCapture);
      window.removeEventListener('synapse:shortcuts', onHelp);
    };
  }, [navigate]);

  useEffect(() => {
    const label = NAV_ITEMS.find((n) => n.view === view)?.label ?? 'Synapse';
    document.title = view === 'dashboard' ? (dueCount ? `(${dueCount}) Synapse` : 'Synapse') : `${label} · Synapse`;
  }, [view, dueCount]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, topicId]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-breathe">
          <Logo compact />
        </div>
      </div>
    );
  }

  const Current = VIEWS[view];

  return (
    <div className="flex min-h-screen">
      <Sidebar dueCount={dueCount} onCapture={() => setPaletteOpen(true)} />

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur md:hidden">
          <Logo />
          <button onClick={() => setPaletteOpen(true)} className="rounded-lg border border-line p-2 text-muted" aria-label="Quick capture">
            <Command size={16} />
          </button>
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-8 sm:px-6 md:px-10 md:pb-16 md:pt-12">
          <Current key={view} />
        </main>
      </div>

      <MobileNav dueCount={dueCount} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNewTopic={(t) => setNewTopicTitle(t)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <TopicEditor
        open={newTopicTitle !== null}
        initialTitle={newTopicTitle ?? ''}
        onClose={() => setNewTopicTitle(null)}
        onSaved={(t) => navigate('topics', t.id)}
      />
    </div>
  );
}
