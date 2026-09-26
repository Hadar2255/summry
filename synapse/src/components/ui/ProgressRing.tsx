import type { ReactNode } from 'react';

interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  tone?: 'accent' | 'good' | 'warn' | 'bad';
  children?: ReactNode;
  track?: boolean;
}

const TONES = { accent: 'text-accent', good: 'text-good', warn: 'text-warn', bad: 'text-bad' };

export function ProgressRing({ value, size = 88, stroke = 7, tone = 'accent', children, track = true }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {track && <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className={`${TONES[tone]} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
