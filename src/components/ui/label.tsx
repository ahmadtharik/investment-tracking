import type { ReactNode } from 'react';

export function Label({
  children,
  htmlFor,
  className = '',
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-xs font-medium tracking-wide text-[var(--text-muted)] ${className}`}
    >
      {children}
    </label>
  );
}
