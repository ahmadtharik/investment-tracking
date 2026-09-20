import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  loadingLabel?: string;
}

const VARIANTS = {
  primary:
    'bg-[var(--color-primary)] text-white shadow-sm hover:-translate-y-px hover:bg-[var(--color-primary-hover)]',
  secondary:
    'border border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-body)] hover:-translate-y-px hover:bg-[var(--color-primary-subtle)]',
  danger:
    'border border-red-200 bg-[var(--danger-soft)] text-red-700 hover:-translate-y-px hover:bg-red-50',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', type = 'button', className = '', loading = false, loadingLabel = 'Loading…', children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex min-h-10 min-w-[6rem] items-center justify-center gap-2 rounded-[var(--radius-control)] px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >{loading && <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}{loading ? loadingLabel : children}</button>
  );
});
