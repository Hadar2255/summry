import { useEffect, useRef } from 'react';

/**
 * Declarative keyboard shortcuts.
 * Combos: "mod+k" (Cmd on macOS, Ctrl elsewhere), "space", "escape", "enter", "shift+?", "1"…
 * Shortcuts are ignored while typing in a field unless `allowInInput` is set.
 */

export interface Hotkey {
  combo: string;
  handler: (e: KeyboardEvent) => void;
  allowInInput?: boolean;
  preventDefault?: boolean;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function normalizeKey(key: string): string {
  if (key === ' ') return 'space';
  return key.toLowerCase();
}

export function matches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  const wantMod = parts.includes('mod');
  const wantShift = parts.includes('shift');
  const wantAlt = parts.includes('alt');
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (wantMod !== mod) return false;
  if (wantAlt !== e.altKey) return false;
  // Shift is implied for single symbols like "?", so only enforce its absence for named keys and alphanumerics.
  if (wantShift && !e.shiftKey) return false;
  if (!wantShift && e.shiftKey && (key.length > 1 || /^[a-z0-9]$/.test(key))) return false;
  const pressed = normalizeKey(e.key);
  if (pressed === key) return true;
  // Digits via the code, so Shift+1 layouts still register as "1" when requested with shift.
  if (/^\d$/.test(key) && e.code === `Digit${key}`) return true;
  return false;
}

export function useHotkeys(hotkeys: Hotkey[], enabled = true) {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const typing = isTypingTarget(e.target);
      for (const hk of ref.current) {
        if (typing && !hk.allowInInput) continue;
        if (matches(e, hk.combo)) {
          if (hk.preventDefault !== false) e.preventDefault();
          hk.handler(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export const modKeyLabel = isMac ? '⌘' : 'Ctrl';
