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
    <header className="border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur md:fixed md:inset-y-0 md:left-0 md:z-20 md:w-64 md:border-b-0 md:border-r">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 md:block md:px-5 md:py-7">
        <Link href="/dashboard" className="flex items-center gap-3 py-1 text-base font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#dceaf3] text-sm text-[var(--accent)]">IP</span>
          Investment Planner
        </Link>
        <nav aria-label="Primary navigation" className="order-3 flex w-full flex-1 items-center gap-1 overflow-x-auto pb-1 sm:order-none sm:w-auto sm:pb-0 md:mt-12 md:block md:space-y-1">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors motion-reduce:transition-none md:block ${
                  active
                    ? 'bg-[#e1edf5] font-medium text-[#24577c]'
                    : 'text-zinc-600 hover:bg-[#f1eee7]'
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
          className="ml-auto rounded-xl border border-[var(--line)] px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-[#f1eee7] motion-reduce:transition-none md:mt-10 md:w-full"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
