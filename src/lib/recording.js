import { useRef, useState, useCallback } from 'react';

const SUPPORTED_MIME = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus'
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of SUPPORTED_MIME) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export function useRecorder() {
  const [state, setState] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(0);
  const resolveRef = useRef(null);
  const rejectRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = new Error('הדפדפן לא תומך בהקלטה');
      setError(e.message);
      throw e;
    }
    const mime = pickMimeType();
    if (!mime) {
      const e = new Error('הדפדפן לא תומך בפורמט שמע נדרש');
      setError(e.message);
      throw e;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (e) {
      const msg = e.name === 'NotAllowedError'
        ? 'גישה למיקרופון נדחתה. אפשרי בהגדרות הדפדפן.'
        : 'לא ניתן לפתוח מיקרופון';
      setError(msg);
      throw new Error(msg);
    }
    streamRef.current = stream;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyserRef.current = analyser;
    src.connect(analyser);

    const buf = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 });
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
    rec.onerror = e => {
      const err = e.error || new Error('שגיאת הקלטה');
      setError(err.message);
      cleanup();
      setState('idle');
      rejectRef.current?.(err);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const elapsed = (performance.now() - startedAtRef.current) / 1000;
      cleanup();
      setState('idle');
      resolveRef.current?.({ blob, mime, durationSec: elapsed });
    };

    startedAtRef.current = performance.now();
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((performance.now() - startedAtRef.current) / 1000);
    }, 250);

    rec.start(1000);
    setState('recording');
  }, [cleanup]);

  const stop = useCallback(() => {
    return new Promise((resolve, reject) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') { resolve(null); return; }
      resolveRef.current = resolve;
      rejectRef.current = reject;
      setState('stopping');
      try { rec.stop(); } catch (e) { cleanup(); setState('idle'); reject(e); }
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try { rec.stop(); } catch {}
    }
    chunksRef.current = [];
    cleanup();
    setState('idle');
    setDuration(0);
  }, [cleanup]);

  return { state, duration, level, error, start, stop, cancel };
}
