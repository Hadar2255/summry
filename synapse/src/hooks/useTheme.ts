import { useEffect, useState } from 'react';
import type { ThemePreference } from '../types';

/** Applies the `dark` class to <html> based on preference, tracking the OS setting for "system". */
export function useTheme(pref: ThemePreference): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    root.classList.toggle('dark', resolved === 'dark');
    const t = window.setTimeout(() => root.classList.remove('theme-transition'), 300);
    return () => window.clearTimeout(t);
  }, [resolved]);

  return resolved;
}
