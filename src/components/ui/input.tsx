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
        ? `w-full cursor-pointer accent-[#4c7895] focus:outline-none focus:ring-2 focus:ring-[#dcecf7] ${className}`
        : `w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] shadow-[0_1px_2px_rgba(53,48,36,0.03)] focus:border-[#78a9ca] focus:outline-none focus:ring-2 focus:ring-[#dcecf7] ${className}`}
      {...props}
    />
  );
});
