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
    <section className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_8px_30px_rgba(53,48,36,0.04)] motion-safe:animate-[fade-in_420ms_ease-out] ${className}`}>
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
