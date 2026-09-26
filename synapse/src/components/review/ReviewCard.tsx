import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, HelpCircle, Shuffle } from 'lucide-react';
import type { Card, Confidence, Grade, Topic } from '../../types';
import { CONFIDENCE_LABEL, GRADE_LABEL, previewIntervals } from '../../utils/srs';
import { formatInterval } from '../../utils/date';
import { elaborationNudge } from '../../utils/prompts';
import { modKeyLabel, useHotkeys } from '../../hooks/useHotkeys';
import { DomainChip } from '../ui/DomainChip';
import { Kbd } from '../ui/Kbd';

type Phase = 'confidence' | 'answer' | 'revealed';

const CONF_STYLE: Record<Confidence, string> = {
  1: 'hover:border-bad/50',
  2: 'hover:border-warn/50',
  3: 'hover:border-accent/50',
  4: 'hover:border-good/50'
};

const GRADE_STYLE: Record<Grade, string> = {
  1: 'border-bad/30 hover:bg-bad/10 text-bad',
  2: 'border-warn/30 hover:bg-warn/10 text-warn',
  3: 'border-accent/30 hover:bg-accent/10 text-accent',
  4: 'border-good/30 hover:bg-good/10 text-good'
};

const GRADE_HINT: Record<Grade, string> = {
  1: 'Wrong or blank',
  2: 'Right, with struggle',
  3: 'Right after a pause',
  4: 'Instant & complete'
};

export interface GradeResult {
  grade: Grade;
  confidence: Confidence;
  responseMs: number;
}

export function ReviewCard({
  card,
  topic,
  switched,
  bonus,
  relearn,
  onGrade,
  onReveal
}: {
  card: Card;
  topic: Topic | undefined;
  switched: boolean;
  bonus: boolean;
  relearn: boolean;
  onGrade: (r: GradeResult) => void;
  onReveal?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('confidence');
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [typed, setTyped] = useState('');
  const shownAt = useRef(Date.now());
  const responseMs = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nudge = useMemo(() => elaborationNudge(topic), [topic, card.id]);

  useEffect(() => {
    setPhase('confidence');
    setConfidence(null);
    setTyped('');
    shownAt.current = Date.now();
  }, [card.id, relearn]);

  const chooseConfidence = (c: Confidence) => {
    setConfidence(c);
    setPhase('answer');
  };

  const reveal = () => {
    if (phase !== 'answer') return;
    responseMs.current = Date.now() - shownAt.current;
    setPhase('revealed');
    inputRef.current?.blur();
    onReveal?.();
  };

  const grade = (g: Grade) => {
    if (phase !== 'revealed' || !confidence) return;
    onGrade({ grade: g, confidence, responseMs: responseMs.current });
  };

  const digit = (n: 1 | 2 | 3 | 4) => () => {
    if (phase === 'confidence') chooseConfidence(n);
    else if (phase === 'revealed') grade(n);
  };

  useHotkeys([
    { combo: '1', handler: digit(1) },
    { combo: '2', handler: digit(2) },
    { combo: '3', handler: digit(3) },
    { combo: '4', handler: digit(4) },
    { combo: 'space', handler: reveal },
    { combo: 'enter', handler: reveal },
    { combo: 'mod+enter', handler: reveal, allowInInput: true }
  ]);

  const previews = confidence ? previewIntervals(card.srs, confidence) : null;

  return (
    <div className="animate-flip-in" style={{ perspective: 1200 }}>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        {topic && <DomainChip domain={topic.domain} />}
        <span className="text-[13px] font-medium text-muted">{topic?.title}</span>
        {switched && (
          <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent" title="Interleaving: this card is from a different topic than the last one">
            <ArrowLeftRight size={11} /> context switch
          </span>
        )}
        {bonus && (
          <span className="flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[11px] text-muted" title="Pulled in early to mix at least 3 topics">
            <Shuffle size={11} /> interleave fill
          </span>
        )}
        {relearn && <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[11px] font-medium text-bad">relearning</span>}
      </div>

      <div className="card relative overflow-hidden px-6 py-10 text-center shadow-xl shadow-black/5 md:px-12 md:py-14">
        <p className="display mx-auto max-w-2xl text-[26px] leading-snug md:text-[32px]">{card.prompt}</p>

        {phase === 'revealed' && (
          <div className="mx-auto mt-8 max-w-2xl border-t border-line pt-8 animate-flip-in">
            <p className="eyebrow mb-3">Answer</p>
            <p className="text-[17px] leading-relaxed">{card.answer}</p>
            {typed.trim() && (
              <div className="mt-6 rounded-xl border border-dashed border-line bg-canvas/40 p-4 text-left">
                <p className="eyebrow mb-1.5">What you wrote</p>
                <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-muted">{typed}</p>
              </div>
            )}
            <p className="mt-6 flex items-center justify-center gap-1.5 text-[13px] italic text-muted">
              <HelpCircle size={14} className="text-accent" /> {nudge}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6">
        {phase === 'confidence' && (
          <div className="animate-fade-in">
            <p className="mb-3 text-center text-[13.5px] text-muted">
              Before you answer: <b className="font-medium text-ink">how confident are you?</b>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([1, 2, 3, 4] as Confidence[]).map((c) => (
                <button
                  key={c}
                  onClick={() => chooseConfidence(c)}
                  className={`flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left text-[14px] transition ${CONF_STYLE[c]}`}
                >
                  <span>
                    <span className="block font-medium">{CONFIDENCE_LABEL[c]}</span>
                    <span className="block text-[11.5px] text-faint">{['~25%', '~50%', '~75%', '~95%'][c - 1]} sure</span>
                  </span>
                  <Kbd>{c}</Kbd>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'answer' && (
          <div className="animate-fade-in">
            <textarea
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Optional: write your answer before revealing — it makes self-grading honest."
              className="textarea min-h-[90px] bg-surface/80"
            />
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={reveal}
                className="inline-flex h-12 items-center gap-3 rounded-xl bg-ink px-8 text-[15px] font-medium text-canvas transition hover:opacity-90"
              >
                Reveal answer <Kbd className="!border-transparent !bg-canvas/20 !text-canvas">Space</Kbd>
              </button>
              <span className="text-[12px] text-faint">
                Confidence: {confidence && CONFIDENCE_LABEL[confidence]} · while typing use {modKeyLabel}+↵
              </span>
            </div>
          </div>
        )}

        {phase === 'revealed' && previews && (
          <div className="animate-fade-in">
            <p className="mb-3 text-center text-[13.5px] text-muted">
              How accurate was your recall? <span className="text-faint">(you said: {confidence && CONFIDENCE_LABEL[confidence].toLowerCase()})</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([1, 2, 3, 4] as Grade[]).map((g) => (
                <button key={g} onClick={() => grade(g)} className={`rounded-xl border bg-surface px-4 py-3 text-left transition ${GRADE_STYLE[g]}`}>
                  <span className="flex items-center justify-between">
                    <span className="font-medium">{GRADE_LABEL[g]}</span>
                    <Kbd>{g}</Kbd>
                  </span>
                  <span className="mt-1 block text-[11.5px] text-muted">{GRADE_HINT[g]}</span>
                  <span className="mt-1 block font-mono text-[11px] text-faint">next: {formatInterval(previews[g])}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
