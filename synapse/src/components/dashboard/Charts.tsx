import type { Calibration, DayActivity } from '../../utils/metrics';

export function ForecastBars({ data }: { data: Array<{ date: Date; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-36 items-end gap-2">
      {data.map((d, i) => {
        const h = d.count === 0 ? 3 : 12 + (d.count / max) * 100;
        const label = i === 0 ? 'Today' : d.date.toLocaleDateString(undefined, { weekday: 'short' });
        return (
          <div key={i} className="group flex flex-1 flex-col items-center gap-2">
            <span className="font-mono text-[11px] tabular-nums text-muted opacity-0 transition group-hover:opacity-100">{d.count}</span>
            <div
              className={`w-full rounded-md transition-all duration-500 ${i === 0 ? 'bg-accent' : 'bg-accent/25 group-hover:bg-accent/45'}`}
              style={{ height: `${h}px` }}
              title={`${d.count} card${d.count === 1 ? '' : 's'}`}
            />
            <span className={`text-[11px] ${i === 0 ? 'font-medium text-ink' : 'text-faint'}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ActivityStrip({ data }: { data: DayActivity[] }) {
  const max = Math.max(1, ...data.map((d) => d.reviews + d.other * 3));
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
      {data.map((d) => {
        const v = d.reviews + d.other * 3;
        const level = v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4));
        const opacity = [0, 0.22, 0.42, 0.66, 0.95][level];
        return (
          <div
            key={d.key}
            className="aspect-square rounded-[5px] border border-line/60"
            style={{ background: level ? `rgb(var(--accent) / ${opacity})` : undefined }}
            title={`${d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${d.reviews} reviews, ${d.other} other sessions`}
          />
        );
      })}
    </div>
  );
}

export function Sparkline({ values, height = 36 }: { values: Array<number | null>; height?: number }) {
  const w = 120;
  const pts = values.map((v, i) => ({ x: (i / Math.max(1, values.length - 1)) * w, v }));
  const valid = pts.filter((p): p is { x: number; v: number } => p.v !== null);
  if (valid.length < 2) return <div style={{ height }} />;
  const y = (v: number) => height - 4 - v * (height - 8);
  const d = valid.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = valid[valid.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full overflow-visible" style={{ height }} preserveAspectRatio="none">
      <path d={`${d} L${last.x},${height} L${valid[0].x},${height} Z`} className="fill-good/10" />
      <path d={d} fill="none" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" className="stroke-good" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={y(last.v)} r="2.5" className="fill-good" />
    </svg>
  );
}

export function CalibrationChart({ cal }: { cal: Calibration }) {
  const size = 150;
  const pad = 18;
  const s = (v: number) => pad + v * (size - pad * 2);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-[150px] w-[150px] shrink-0">
      <rect x={pad} y={pad} width={size - pad * 2} height={size - pad * 2} rx="6" className="fill-none stroke-line" />
      <line x1={s(0)} y1={size - s(0)} x2={s(1)} y2={size - s(1)} strokeDasharray="3 4" className="stroke-faint" />
      {cal.buckets.map((b) =>
        b.actual === null ? null : (
          <g key={b.level}>
            <line x1={s(b.expected)} y1={size - s(b.expected)} x2={s(b.expected)} y2={size - s(b.actual)} className="stroke-accent/40" strokeWidth="1.5" />
            <circle cx={s(b.expected)} cy={size - s(b.actual)} r={3 + Math.min(5, Math.sqrt(b.n))} className="fill-accent" opacity="0.85">
              <title>{`Confidence ${b.level}: expected ${Math.round(b.expected * 100)}%, actual ${Math.round(b.actual * 100)}% (${b.n})`}</title>
            </circle>
          </g>
        )
      )}
      <text x={size / 2} y={size - 3} textAnchor="middle" className="fill-faint font-mono text-[8px]">confidence →</text>
      <text x={7} y={size / 2} textAnchor="middle" transform={`rotate(-90 7 ${size / 2})`} className="fill-faint font-mono text-[8px]">accuracy →</text>
    </svg>
  );
}
