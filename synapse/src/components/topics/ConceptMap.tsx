import { useMemo, useState } from 'react';
import type { Topic } from '../../types';
import { domainHue } from '../../utils/domain';

/** Radial graph of topics (grouped by domain) and their cross-domain links. */
export function ConceptMap({ topics, onSelect }: { topics: Topic[]; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 560;
  const H = 300;

  const layout = useMemo(() => {
    const sorted = [...topics].sort((a, b) => a.domain.localeCompare(b.domain) || a.title.localeCompare(b.title));
    const n = sorted.length;
    const rx = n <= 1 ? 0 : W / 2 - 110;
    const ry = n <= 1 ? 0 : H / 2 - 50;
    const pos = new Map<string, { x: number; y: number; topic: Topic }>();
    sorted.forEach((t, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      pos.set(t.id, { x: W / 2 + Math.cos(a) * rx, y: H / 2 + Math.sin(a) * ry, topic: t });
    });
    const edges: Array<{ from: string; to: string; relation: string; key: string }> = [];
    const seen = new Set<string>();
    for (const t of topics) {
      for (const l of t.links) {
        if (!pos.has(l.targetTopicId)) continue;
        const key = [t.id, l.targetTopicId].sort().join('|') + l.relation;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: t.id, to: l.targetTopicId, relation: l.relation, key });
      }
    }
    return { pos, edges };
  }, [topics]);

  if (!topics.length) return null;

  const hoveredEdge = hover ? layout.edges.filter((e) => e.from === hover || e.to === hover) : [];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Concept map of topics and cross-domain links">
        {layout.edges.map((e) => {
          const a = layout.pos.get(e.from)!;
          const b = layout.pos.get(e.to)!;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const cx = mx + (W / 2 - mx) * 0.5;
          const cy = my + (H / 2 - my) * 0.5;
          const active = hover && (e.from === hover || e.to === hover);
          return (
            <path
              key={e.key}
              d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`}
              fill="none"
              strokeWidth={active ? 2 : 1.25}
              strokeDasharray={active ? undefined : '4 5'}
              className={`transition-all duration-300 ${active ? 'stroke-accent' : 'stroke-faint/60'}`}
            />
          );
        })}
        {[...layout.pos.values()].map(({ x, y, topic }) => {
          const h = domainHue(topic.domain);
          const dim = hover && hover !== topic.id && !hoveredEdge.some((e) => e.from === topic.id || e.to === topic.id);
          return (
            <g
              key={topic.id}
              transform={`translate(${x},${y})`}
              className={`cursor-pointer transition-opacity duration-300 ${dim ? 'opacity-30' : ''}`}
              onMouseEnter={() => setHover(topic.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(topic.id)}
            >
              <circle r="22" fill={`hsl(${h} 70% 55% / 0.14)`} />
              <circle r="7" fill={`hsl(${h} 70% 55%)`} />
              <text y="38" textAnchor="middle" className="fill-ink text-[12.5px] font-medium">
                {topic.title}
              </text>
              <text y="53" textAnchor="middle" className="fill-muted font-mono text-[9.5px] uppercase tracking-wider">
                {topic.domain}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 min-h-[20px] text-center text-[12.5px] italic text-muted">
        {hoveredEdge.map((e) => (
          <div key={e.key}>“{e.relation}”</div>
        ))}
      </div>
    </div>
  );
}
