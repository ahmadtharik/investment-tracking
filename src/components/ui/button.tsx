import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  loadingLabel?: string;
}

const VARIANTS = {
  primary:
    'bg-[var(--accent)] text-white shadow-sm hover:-translate-y-px hover:bg-[#255d88]',
  secondary:
    'border border-[var(--line)] bg-[var(--surface)] text-zinc-700 hover:-translate-y-px hover:bg-[#f1eee7]',
  danger:
    'border border-red-200 bg-[#fff8f7] text-red-700 hover:-translate-y-px hover:bg-red-50',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', type = 'button', className = '', loading = false, loadingLabel = 'Loading…', children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex min-w-[6rem] items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >{loading && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}{loading ? loadingLabel : children}</button>
  );
});
