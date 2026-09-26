import type { IssueKind, ScanIssue, ScanResult } from '../../utils/jargon';
import { segmentText } from '../../utils/jargon';
import { ProgressRing } from '../ui/ProgressRing';

export const ISSUE_META: Record<IssueKind, { label: string; swatch: string }> = {
  'long-sentence': { label: 'Long sentence', swatch: 'mark-long-sentence' },
  jargon: { label: 'Jargon / buzzword', swatch: 'mark-jargon' },
  acronym: { label: 'Undefined acronym', swatch: 'mark-acronym' },
  'hand-wave': { label: 'Hand-waving', swatch: 'mark-hand-wave' },
  'complex-word': { label: 'Complex word', swatch: 'mark-complex-word' }
};

export function ScoreCard({ scan }: { scan: ScanResult }) {
  const tone = scan.words === 0 ? 'accent' : scan.clarityScore >= 80 ? 'good' : scan.clarityScore >= 55 ? 'warn' : 'bad';
  return (
    <div className="card p-5">
      <div className="flex items-center gap-4">
        <ProgressRing value={scan.clarityScore / 100} tone={tone} size={84}>
          <span className="font-display text-2xl tabular-nums">{scan.words ? scan.clarityScore : '–'}</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="eyebrow">Clarity score</p>
          <p className="mt-1.5 text-[13.5px] leading-snug">{scan.verdict}</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ['Grade', scan.words ? scan.readingGrade.toFixed(1) : '–', 'Target ≤ 6'],
          ['Words / sent.', scan.words ? scan.avgSentenceLength.toFixed(1) : '–', 'Target ≤ 15'],
          ['Flags', String(scan.issues.filter((i) => i.kind !== 'complex-word').length), 'jargon, length…']
        ].map(([k, v, hint]) => (
          <div key={k} className="rounded-xl bg-raised/60 px-2 py-3">
            <dd className="font-display text-xl tabular-nums">{v}</dd>
            <dt className="mt-0.5 text-[11px] text-muted">{k}</dt>
            <dt className="text-[10px] text-faint">{hint}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function IssueList({ issues, onPick }: { issues: ScanIssue[]; onPick: (i: ScanIssue) => void }) {
  const ranked = [...issues].sort((a, b) => sev(b) - sev(a) || a.start - b.start).slice(0, 40);
  return (
    <ul className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
      {ranked.map((i, idx) => (
        <li key={`${i.kind}-${i.start}-${idx}`}>
          <button onClick={() => onPick(i)} className="w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-raised">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${i.severity === 'high' ? 'bg-bad' : i.severity === 'warn' ? 'bg-warn' : 'bg-faint'}`} />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{ISSUE_META[i.kind].label}</span>
            </div>
            <p className="mt-1 truncate text-[13.5px] font-medium">“{i.text.length > 60 ? `${i.text.slice(0, 60)}…` : i.text}”</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{i.message}</p>
          </button>
        </li>
      ))}
      {!issues.length && <li className="px-3 py-4 text-[13px] text-muted">No flags. Plain language wins.</li>}
    </ul>
  );
}

const sev = (i: ScanIssue) => (i.severity === 'high' ? 3 : i.severity === 'warn' ? 2 : 1);

export function HighlightedText({ text, issues }: { text: string; issues: ScanIssue[] }) {
  const segments = segmentText(text, issues);
  if (!text.trim()) return <p className="text-[14px] text-faint">The scanner view will mirror your explanation here with every flag highlighted.</p>;
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-[1.9]">
      {segments.map((s, i) =>
        s.kinds.length ? (
          <span key={i} title={s.messages.join('\n')} className={s.kinds.map((k) => ISSUE_META[k].swatch).join(' ')}>
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </p>
  );
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
      {Object.entries(ISSUE_META).map(([k, m]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`${m.swatch} px-1 text-ink`}>Aa</span>
          {m.label}
        </span>
      ))}
    </div>
  );
}
