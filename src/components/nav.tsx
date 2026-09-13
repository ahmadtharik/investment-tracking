'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/settings', label: 'Settings' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/fx', label: 'FX' },
  { href: '/projections', label: 'Projections' },
  { href: '/rules', label: 'Rules' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4">
        <Link href="/dashboard" className="py-3 text-sm font-semibold tracking-tight">
          Investment Planner
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await clientSupabase().auth.signOut();
            window.location.href = '/login';
          }}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}