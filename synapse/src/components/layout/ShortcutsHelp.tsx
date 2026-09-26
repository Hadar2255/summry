import { Modal } from '../ui/Modal';
import { Kbd } from '../ui/Kbd';
import { modKeyLabel } from '../../hooks/useHotkeys';
import { NAV_ITEMS } from './navItems';

const GROUPS: Array<{ title: string; rows: Array<[string[], string]> }> = [
  {
    title: 'Global',
    rows: [
      [[modKeyLabel, 'K'], 'Quick capture & command palette'],
      [['?'], 'Show this help'],
      [['Esc'], 'Close dialog / exit focus session']
    ]
  },
  {
    title: 'Review session',
    rows: [
      [['1', '–', '4'], 'Rate confidence (before reveal)'],
      [['Space'], 'Reveal answer'],
      [[modKeyLabel, '↵'], 'Reveal while typing'],
      [['1', '–', '4'], 'Grade Again · Hard · Good · Easy']
    ]
  },
  {
    title: 'Practice',
    rows: [
      [['↵'], 'Start deck / blurt from its page'],
      [[modKeyLabel, '↵'], 'Submit blurt · save synthesis'],
      [['1', '–', '3'], 'Grade blurt High · Medium · Low'],
      [['N'], 'New synthesis prompt']
    ]
  }
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" subtitle="Synapse is built to be driven from the keyboard." width="lg">
      <div className="grid gap-8 md:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <p className="eyebrow mb-3">{g.title}</p>
            <ul className="space-y-2.5">
              {g.rows.map(([keys, label], i) => (
                <li key={i} className="flex items-center justify-between gap-4 text-[13.5px]">
                  <span className="text-muted">{label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {keys.map((k, j) => (k === '–' ? <span key={j} className="text-faint">–</span> : <Kbd key={j}>{k}</Kbd>))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <p className="eyebrow mb-3">Go to (press G, then…)</p>
          <ul className="space-y-2.5">
            {NAV_ITEMS.map((n) => (
              <li key={n.view} className="flex items-center justify-between text-[13.5px]">
                <span className="text-muted">{n.label}</span>
                <span className="flex items-center gap-1">
                  <Kbd>G</Kbd>
                  <Kbd>{n.chord.toUpperCase()}</Kbd>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
