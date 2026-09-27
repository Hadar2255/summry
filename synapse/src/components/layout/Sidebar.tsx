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

  // md–lg (iPad portrait): 76px icon rail. lg+ (iPad landscape, desktop): full sidebar.
  return (
    <aside className="sticky top-0 hidden h-screen h-[100dvh] w-[76px] shrink-0 flex-col items-center border-r border-line bg-surface/60 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur md:flex lg:w-[248px] lg:items-stretch lg:px-4">
      <div className="lg:px-2">
        <span className="lg:hidden">
          <Logo compact />
        </span>
        <span className="hidden lg:block">
          <Logo />
        </span>
      </div>

      <button
        onClick={onCapture}
        title="Capture or jump"
        aria-label="Capture or jump"
        className="mt-6 flex h-11 w-11 items-center justify-center gap-2.5 rounded-xl border border-line bg-canvas/60 text-left text-sm text-muted transition hover:border-faint hover:text-ink lg:h-auto lg:w-auto lg:justify-start lg:px-3 lg:py-2"
      >
        <Command size={16} />
        <span className="hidden flex-1 truncate lg:inline">Capture / jump</span>
        <span className="hidden items-center gap-1 lg:flex">
          <Kbd>{modKeyLabel}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <nav className="mt-6 flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto lg:items-stretch lg:gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = view === item.view;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex h-12 w-12 items-center justify-center gap-3 rounded-xl text-left text-[14px] transition lg:h-auto lg:w-auto lg:justify-start lg:px-3 lg:py-2.5 ${
                active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60 hover:text-ink'
              }`}
            >
              {active && <span className="absolute -left-3 top-3 h-6 w-[3px] rounded-r-full bg-accent lg:left-0 lg:top-2.5 lg:h-5" />}
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} className={`shrink-0 lg:h-[17px] lg:w-[17px] ${active ? 'text-accent' : ''}`} />
              <span className="hidden flex-1 lg:block">
                <span className="block font-medium leading-tight">{item.label}</span>
                {item.principle && <span className="block text-[11px] text-faint">{item.principle}</span>}
              </span>
              {item.view === 'review' && dueCount > 0 && (
                <>
                  <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent lg:hidden" />
                  <span className="hidden rounded-full bg-accent px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-ink lg:inline">{dueCount}</span>
                </>
              )}
              <span className="kbd-hint hidden font-mono text-[10px] text-faint lg:group-hover:inline">g {item.chord}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 flex w-full flex-col items-center gap-2 border-t border-line pt-4 lg:flex-row lg:justify-between lg:px-1">
        <span
          className="flex items-center gap-1.5 text-[11.5px] text-faint"
          title={saveStatus === 'error' ? 'Save failed' : storageBackend === 'local' ? 'Saved to localStorage' : 'Saved on this device'}
        >
          {saveStatus === 'saving' ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saveStatus === 'error' ? (
            <CloudOff size={14} className="text-bad" />
          ) : (
            <Cloud size={14} />
          )}
          <span className="hidden lg:inline">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved locally'}</span>
        </span>
        <div className="flex flex-col items-center gap-1 lg:flex-row">
          <button
            onClick={() => dispatch({ type: 'settings/update', patch: { theme: THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % 3] } })}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-ink lg:h-9 lg:w-9"
            title={`Theme: ${theme}`}
            aria-label={`Theme: ${theme}. Tap to change.`}
          >
            <ThemeIcon size={16} />
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('synapse:shortcuts'))}
            className="kbd-hint flex h-9 w-9 items-center justify-center rounded-lg font-mono text-xs text-muted transition hover:bg-raised hover:text-ink"
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
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/90 px-[max(0.25rem,env(safe-area-inset-left))] pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
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
