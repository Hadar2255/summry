import { useCallback, useEffect, useRef, useState } from 'react';

/** Countdown (durationSec > 0) or stopwatch (durationSec = 0) driven by wall-clock time. */
export function useTimer(durationSec: number, onExpire?: () => void) {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const banked = useRef(0);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const total = banked.current + (startedAt.current ? Date.now() - startedAt.current : 0);
      setElapsedMs(total);
      if (durationSec > 0 && total >= durationSec * 1000) {
        banked.current = durationSec * 1000;
        startedAt.current = null;
        setElapsedMs(durationSec * 1000);
        setRunning(false);
        expireRef.current?.();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, durationSec]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (startedAt.current) banked.current += Date.now() - startedAt.current;
    startedAt.current = null;
    setElapsedMs(banked.current);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    banked.current = 0;
    startedAt.current = null;
    setElapsedMs(0);
    setRunning(false);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  const remainingSec = durationSec > 0 ? Math.max(0, durationSec - elapsedSec) : 0;
  const progress = durationSec > 0 ? Math.min(1, elapsedSec / durationSec) : 0;

  return { running, elapsedSec, remainingSec, progress, start, pause, reset };
}
