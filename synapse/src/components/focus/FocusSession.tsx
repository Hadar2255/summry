import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, VolumeX, Waves, X, Pause, Play } from 'lucide-react';
import { useStore } from '../../hooks/useStore';
import { audio } from '../../utils/audio';
import { formatClock } from '../../utils/date';
import { Kbd } from '../ui/Kbd';

interface FocusSessionProps {
  open: boolean;
  onExit: () => void;
  title: string;
  subtitle?: ReactNode;
  /** 0–1 progress through the session (cards done, time used…). */
  progress?: number;
  /** Optional countdown text rendered prominently instead of the elapsed clock. */
  countdown?: { remainingSec: number; totalSec: number; paused?: boolean; onTogglePause?: () => void } | null;
  children: ReactNode;
}

/**
 * Distraction-free full-screen shell for deliberate practice.
 * Shows a calm elapsed timer with a breathing halo, toggles for audio cues and ambient noise,
 * and exits on Esc (nested modals capture Esc first).
 */
export function FocusSession({ open, onExit, title, subtitle, progress, countdown, children }: FocusSessionProps) {
  const { state, dispatch } = useStore();
  const { audioCues, ambientSound } = state.settings;
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useEffect(() => {
    if (!open) return;
    startRef.current = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        exitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  useEffect(() => {
    if (open && ambientSound) audio.startAmbient();
    else audio.stopAmbient();
    return () => audio.stopAmbient();
  }, [open, ambientSound]);

  if (!open) return null;

  const cd = countdown;
  const urgent = cd ? cd.remainingSec <= 20 && !cd.paused : false;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-canvas animate-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="grain pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-[-20vh] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl animate-breathe" />

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-4 md:px-8">
        <div className="min-w-0">
          <p className="eyebrow">Focus session</p>
          <h2 className="display truncate text-lg md:text-xl">{title}</h2>
          {subtitle && <div className="mt-0.5 truncate text-[13px] text-muted">{subtitle}</div>}
        </div>

        <div className="flex items-center gap-1.5">
          {cd ? (
            <button
              onClick={cd.onTogglePause}
              className={`mr-2 flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-sm tabular-nums transition ${
                urgent ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line bg-surface text-ink'
              }`}
              title={cd.paused ? 'Resume timer' : 'Pause timer'}
            >
              {cd.onTogglePause && (cd.paused ? <Play size={13} /> : <Pause size={13} />)}
              {formatClock(cd.remainingSec)}
            </button>
          ) : (
            <span className="mr-2 rounded-full border border-line bg-surface px-3.5 py-1.5 font-mono text-sm tabular-nums text-muted">
              {formatClock(elapsed)}
            </span>
          )}
          <button
            onClick={() => dispatch({ type: 'settings/update', patch: { audioCues: !audioCues } })}
            className={`rounded-lg p-2 transition hover:bg-raised ${audioCues ? 'text-ink' : 'text-faint'}`}
            title={audioCues ? 'Audio cues on' : 'Audio cues off'}
            aria-pressed={audioCues}
          >
            {audioCues ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            onClick={() => dispatch({ type: 'settings/update', patch: { ambientSound: !ambientSound } })}
            className={`rounded-lg p-2 transition hover:bg-raised ${ambientSound ? 'text-accent' : 'text-faint'}`}
            title={ambientSound ? 'Ambient sound on' : 'Ambient sound off'}
            aria-pressed={ambientSound}
          >
            <Waves size={17} />
          </button>
          <button
            onClick={onExit}
            className="ml-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted transition hover:bg-raised hover:text-ink"
          >
            <Kbd>Esc</Kbd>
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="relative z-10 h-[2px] w-full bg-line/60">
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${Math.round((cd ? 1 - cd.remainingSec / Math.max(1, cd.totalSec) : progress ?? 0) * 100)}%` }}
        />
      </div>

      <main className="relative z-10 flex-1 overflow-y-auto px-5 py-8 md:px-8">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>,
    document.body
  );
}
