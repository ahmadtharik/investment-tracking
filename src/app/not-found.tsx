import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return <main className="mx-auto max-w-lg px-4 py-24 text-center">
    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Page not found</h1>
    <p className="mt-2 text-sm text-[var(--text-muted)]">This page doesn&apos;t exist or has moved.</p>
    <Link href="/" className="mt-5 inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3.5 py-2 text-sm font-medium">Go to the home page</Link>
  </main>;
}
