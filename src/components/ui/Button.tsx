import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'danger' | 'success' | 'ghost' | 'subtle';
type Size = 'md' | 'lg' | 'xl';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/20',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20',
  ghost: 'bg-transparent hover:bg-ink-800 text-slate-200',
  subtle: 'bg-ink-800 hover:bg-ink-700 text-slate-100',
};

const sizes: Record<Size, string> = {
  md: 'min-h-[44px] px-4 text-base rounded-xl',
  lg: 'min-h-[56px] px-6 text-lg rounded-2xl',
  xl: 'min-h-[72px] px-8 text-2xl rounded-3xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold',
        'transition-colors active:scale-[0.98] select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        full ? 'w-full' : '',
        className,
      ].join(' ')}
    />
  );
}
