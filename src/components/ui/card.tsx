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
    <section className={`min-w-0 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] motion-safe:animate-[fade-in_420ms_ease-out] sm:p-6 ${className}`}>
      {title && (
        <header className="mb-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
