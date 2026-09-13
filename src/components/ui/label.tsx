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
      className={`block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 ${className}`}
    >
      {children}
    </label>
  );
}