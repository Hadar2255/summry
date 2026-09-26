import type { ReactNode } from 'react';

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line bg-raised px-1.5 font-mono text-[10.5px] font-medium text-muted shadow-[0_1px_0_rgb(var(--line))] ${className}`}
    >
      {children}
    </kbd>
  );
}
