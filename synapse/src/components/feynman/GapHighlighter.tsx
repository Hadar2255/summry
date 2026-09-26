import { useState } from 'react';
import { AlertCircle, Check, CornerDownLeft, Sparkles, Trash2 } from 'lucide-react';
import type { KnowledgeGap } from '../../types';
import { Button } from '../ui/Button';

/**
 * "Where did I hesitate or get stuck?" — friction points logged during explanation,
 * each convertible into a spaced-repetition card.
 */
export function GapHighlighter({
  gaps,
  onAdd,
  onRemove,
  onConvert
}: {
  gaps: KnowledgeGap[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
  onConvert: (gap: KnowledgeGap, prompt: string, answer: string) => void;
}) {
  const [text, setText] = useState('');
  const [converting, setConverting] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');

  const add = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };

  const startConvert = (g: KnowledgeGap) => {
    setConverting(g.id);
    const t = g.text.trim();
    setPrompt(/\?$/.test(t) ? t : `Explain: ${t.replace(/^(I (was|am|got) (unsure|stuck|confused) (about|on)\s*)/i, '')}`);
    setAnswer('');
  };

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warn/10 text-warn">
          <AlertCircle size={18} />
        </div>
        <div>
          <p className="font-medium">Knowledge gap highlighter</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
            Where did you hesitate, hand-wave, or get stuck? Every friction point is a card waiting to be written.
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. I couldn’t explain why latency grows with queue length"
        />
        <Button variant="secondary" onClick={add} disabled={!text.trim()} aria-label="Log gap">
          <CornerDownLeft size={15} />
        </Button>
      </div>

      <ul className="mt-4 space-y-2">
        {gaps.map((g) => (
          <li key={g.id} className={`rounded-xl border p-3.5 transition ${g.cardId ? 'border-good/30 bg-good/5' : 'border-line bg-canvas/40'}`}>
            <div className="flex items-start gap-3">
              <p className="flex-1 text-[14px] leading-snug">{g.text}</p>
              {g.cardId ? (
                <span className="flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-good">
                  <Check size={13} /> Card created
                </span>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="soft" icon={<Sparkles size={13} />} onClick={() => startConvert(g)}>
                    Make card
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Remove gap" onClick={() => onRemove(g.id)} className="!h-8 !w-8">
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </div>
            {converting === g.id && (
              <div className="mt-3 space-y-2 border-t border-line pt-3 animate-fade-in">
                <input className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Question" />
                <textarea
                  className="textarea min-h-[70px]"
                  autoFocus
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Look it up now, then write the answer in your own words."
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConverting(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!prompt.trim() || !answer.trim()}
                    onClick={() => {
                      onConvert(g, prompt, answer);
                      setConverting(null);
                    }}
                  >
                    Add to deck
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {!gaps.length && <li className="py-2 text-[13px] text-faint">No gaps logged for this draft yet.</li>}
      </ul>
    </div>
  );
}
