import { Command, Moon, Sun, Monitor, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useNav } from '../../hooks/useNav';
import { useStore } from '../../hooks/useStore';
import { modKeyLabel } from '../../hooks/useHotkeys';
import type { ThemePreference } from '../../types';
import { Kbd } from '../ui/Kbd';
import { NAV_ITEMS } from './navItems';

const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-ink" />
        <path d="M9 21c3-7 11-3 14-10" fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-canvas" />
        <circle cx="9" cy="21" r="2.6" className="fill-accent" />
        <circle cx="23" cy="11" r="2.6" className="fill-accent" />
      </svg>
      {!compact && <span className="display text-[21px] font-medium">Synapse</span>}
    </div>
  );
}

export function Sidebar({ dueCount, onCapture }: { dueCount: number; onCapture: () => void }) {
  const { view, navigate } = useNav();
  const { state, dispatch, saveStatus, storageBackend } = useStore();
  const theme = state.settings.theme;
  const ThemeIcon = THEME_ICON[theme];

  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-surface/60 px-4 py-5 backdrop-blur md:flex">
      <div className="px-2">
        <Logo />
      </div>

      <button
        onClick={onCapture}
        className="mt-6 flex items-center gap-2.5 rounded-xl border border-line bg-canvas/60 px-3 py-2 text-left text-sm text-muted transition hover:border-faint hover:text-ink"
      >
        <Command size={15} />
        <span className="flex-1 truncate">Capture / jump</span>
        <Kbd>{modKeyLabel}</Kbd>
        <Kbd>K</Kbd>
      </button>

      <nav className="mt-6 flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = view === item.view;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition ${
                active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60 hover:text-ink'
              }`}
            >
              {active && <span className="absolute left-0 top-2.5 h-5 w-[3px] rounded-r-full bg-accent" />}
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className={active ? 'text-accent' : ''} />
              <span className="flex-1">
                <span className="block font-medium leading-tight">{item.label}</span>
                {item.principle && <span className="block text-[11px] text-faint">{item.principle}</span>}
              </span>
              {item.view === 'review' && dueCount > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-ink">{dueCount}</span>
              )}
              <span className="hidden font-mono text-[10px] text-faint group-hover:inline">g {item.chord}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 flex items-center justify-between border-t border-line px-1 pt-4">
        <span className="flex items-center gap-1.5 text-[11.5px] text-faint" title={storageBackend === 'local' ? 'Saved to localStorage' : 'Saved to IndexedDB'}>
          {saveStatus === 'saving' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : saveStatus === 'error' ? (
            <CloudOff size={13} className="text-bad" />
          ) : (
            <Cloud size={13} />
          )}
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved locally'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => dispatch({ type: 'settings/update', patch: { theme: THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % 3] } })}
            className="rounded-lg p-2 text-muted transition hover:bg-raised hover:text-ink"
            title={`Theme: ${theme}`}
            aria-label={`Theme: ${theme}. Click to change.`}
          >
            <ThemeIcon size={16} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('synapse:shortcuts'))}
            className="rounded-lg px-2 py-1.5 font-mono text-xs text-muted transition hover:bg-raised hover:text-ink"
            title="Keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ dueCount }: { dueCount: number }) {
  const { view, navigate } = useNav();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/90 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      {NAV_ITEMS.filter((i) => i.view !== 'settings').map((item) => {
        const Icon = item.icon;
        const active = view === item.view;
        return (
          <button
            key={item.view}
            onClick={() => navigate(item.view)}
            className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] ${active ? 'text-accent' : 'text-muted'}`}
          >
            <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
            {item.short}
            {item.view === 'review' && dueCount > 0 && (
              <span className="absolute right-[18%] top-1.5 h-2 w-2 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
