import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { NavTarget, View } from '../types';

const VIEWS: View[] = ['dashboard', 'topics', 'feynman', 'gym', 'review', 'synthesis', 'settings'];

function parseHash(): NavTarget {
  const [, view, topicId] = window.location.hash.replace(/^#/, '').split('/');
  return VIEWS.includes(view as View) ? { view: view as View, topicId: topicId || undefined } : { view: 'dashboard' };
}

function toHash(t: NavTarget): string {
  return `#/${t.view}${t.topicId ? `/${t.topicId}` : ''}`;
}

interface NavValue extends NavTarget {
  navigate: (view: View, topicId?: string) => void;
}

const NavContext = createContext<NavValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<NavTarget>(() => parseHash());

  useEffect(() => {
    const onHash = () => setTarget(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((view: View, topicId?: string) => {
    const next = { view, topicId };
    const hash = toHash(next);
    if (window.location.hash !== hash) window.location.hash = hash;
    setTarget(next);
  }, []);

  const value = useMemo(() => ({ ...target, navigate }), [target, navigate]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside <NavProvider>');
  return ctx;
}
