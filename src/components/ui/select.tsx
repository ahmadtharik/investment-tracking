import { forwardRef, type SelectHTMLAttributes } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...props },
  ref
) {
  return (
    <span className="group relative block w-full">
      <select
        ref={ref}
        className={`w-full min-w-0 appearance-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 pr-10 text-sm text-[var(--ink)] shadow-[0_1px_2px_rgba(53,48,36,0.03)] transition-colors duration-150 focus:border-[#78a9ca] focus:outline-none focus:ring-2 focus:ring-[#dcecf7] ${className}`}
        {...props}
      >
        {children}
      </select>
      <svg aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
});
