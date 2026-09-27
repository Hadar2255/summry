import { useEffect, useState } from 'react';
import type { Card, ID } from '../../types';
import { makeCard, useStore } from '../../hooks/useStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TopicSelect } from '../ui/TopicSelect';
import { Kbd } from '../ui/Kbd';
import { modKeyLabel } from '../../hooks/useHotkeys';

export function CardEditor({
  open,
  onClose,
  card,
  topicId,
  initial
}: {
  open: boolean;
  onClose: () => void;
  card?: Card | null;
  topicId?: ID | null;
  initial?: { prompt?: string; answer?: string; origin?: Card['origin'] };
}) {
  const { state, dispatch } = useStore();
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [tid, setTid] = useState<ID | null>(null);

  useEffect(() => {
    if (!open) return;
    setPrompt(card?.prompt ?? initial?.prompt ?? '');
    setAnswer(card?.answer ?? initial?.answer ?? '');
    setTid(card?.topicId ?? topicId ?? state.topics[0]?.id ?? null);
    // Values are captured when the editor opens; re-running on every parent render would wipe typing.
  }, [open]);

  const valid = prompt.trim() && answer.trim() && tid;

  const save = () => {
    if (!valid || !tid) return;
    if (card) dispatch({ type: 'card/update', id: card.id, patch: { prompt: prompt.trim(), answer: answer.trim(), topicId: tid } });
    else dispatch({ type: 'card/add', card: makeCard(tid, prompt, answer, initial?.origin ?? 'manual') });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card ? 'Edit card' : 'New card'}
      subtitle="Write the prompt as a question that forces retrieval — not recognition."
      footer={
        <>
          <span className="kbd-hint mr-auto hidden items-center gap-1.5 text-xs text-faint sm:flex">
            <Kbd>{modKeyLabel}</Kbd>
            <Kbd>↵</Kbd> save
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {card ? 'Save' : 'Add card'}
          </Button>
        </>
      }
    >
      <div
        className="space-y-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      >
        <TopicSelect topics={state.topics} value={tid} onChange={setTid} />
        <label className="block">
          <span className="eyebrow mb-1.5 block">Prompt</span>
          <textarea data-autofocus className="textarea min-h-[80px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Why does…? What happens when…?" />
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block">Answer</span>
          <textarea className="textarea min-h-[110px]" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="The answer you should be able to produce from memory." />
        </label>
      </div>
    </Modal>
  );
}
