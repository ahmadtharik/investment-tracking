'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="mx-auto max-w-lg py-16 text-center">
    <h1 className="text-2xl font-bold text-[var(--text-primary)]">Something went wrong</h1>
    <p className="mt-2 text-sm text-[var(--text-muted)]">We couldn&apos;t load this page. Your saved information hasn&apos;t changed.</p>
    <div className="mt-5 flex justify-center gap-2"><Button onClick={reset}>Try again</Button><Link href="/dashboard" className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-[var(--border)] px-3.5 py-2 text-sm font-medium">Go to dashboard</Link></div>
  </div>;
}
