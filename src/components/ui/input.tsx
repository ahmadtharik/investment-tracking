import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref
) {
  const isRange = props.type === 'range';
  return (
    <input
      ref={ref}
      className={isRange
        ? `w-full cursor-pointer accent-[var(--color-primary)] focus:outline-none ${className}`
        : `w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-sm focus:border-[var(--color-primary)] focus:outline-none ${className}`}
      {...props}
    />
  );
});
