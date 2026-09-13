import type { ReactNode } from 'react';

export function Card({
  title,
  description,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 ${className}`}>
      {title && (
        <header className="mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}