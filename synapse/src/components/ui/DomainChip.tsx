import type { CSSProperties } from 'react';
import { domainHue } from '../../utils/domain';

export function DomainChip({ domain, className = '' }: { domain: string; className?: string }) {
  return (
    <span
      style={{ '--h': domainHue(domain) } as CSSProperties}
      className={`domain-chip inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium ${className}`}
    >
      <span className="domain-dot h-1.5 w-1.5 rounded-full" />
      {domain}
    </span>
  );
}

export function DomainDot({ domain, size = 8 }: { domain: string; size?: number }) {
  return (
    <span
      style={{ '--h': domainHue(domain), width: size, height: size } as CSSProperties}
      className="domain-dot inline-block shrink-0 rounded-full"
    />
  );
}
