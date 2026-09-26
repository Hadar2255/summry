import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_8px_24px_-12px_rgb(var(--accent)/0.7)]',
  secondary: 'bg-surface text-ink border border-line hover:border-faint hover:bg-raised/60',
  ghost: 'text-muted hover:text-ink hover:bg-raised/70',
  danger: 'bg-bad/10 text-bad border border-bad/25 hover:bg-bad/15',
  soft: 'bg-accent/10 text-accent hover:bg-accent/15'
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center'
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, trailing, className = '', children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex shrink-0 select-none items-center font-medium transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
      {trailing}
    </button>
  );
});
