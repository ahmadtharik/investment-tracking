'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clientSupabase } from '@/lib/supabase/client';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';

const LINKS = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/plan', label: 'Plan', icon: 'plan' },
  { href: '/portfolio', label: 'Portfolio', icon: 'portfolio' },
  { href: '/accounts', label: 'Accounts', icon: 'accounts' },
  { href: '/projections', label: 'Projections', icon: 'projections' },
] as const;

function Icon({ name }: { name: string }) { return <AppIcon name={name as AppIconName} />; }

type SearchItem = { id: string; group: 'Pages' | 'Accounts' | 'Holdings' | 'Actions'; title: string; detail: string; href: string; icon: string };

function SearchCommand({ items }: { items: SearchItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = items.filter((item) => `${item.title} ${item.detail} ${item.group}`.toLowerCase().includes(query.trim().toLowerCase()));
  const select = (item: SearchItem) => { setOpen(false); setQuery(''); router.push(item.href); };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(true); }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()); }, [open]);
  const groups: SearchItem['group'][] = ['Pages', 'Accounts', 'Holdings', 'Actions'];
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Open search" className="relative h-[42px] w-full max-w-[385px] rounded-xl border border-[var(--border)] bg-white pl-10 pr-16 text-left text-sm text-[var(--text-muted)] hover:border-[var(--border-strong)]">
      <span className="pointer-events-none absolute left-3 top-2.5"><Icon name="search" /></span>Search anything...
      <kbd className="pointer-events-none absolute right-3 top-2 rounded-md border border-[var(--border)] bg-[var(--surface-page)] px-1.5 py-0.5 text-[10px] font-medium">⌘ K</kbd>
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/20 px-4 pt-[12vh] backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="Global search" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-modal)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="relative border-b border-[var(--border)]"><span className="pointer-events-none absolute left-4 top-3 text-[var(--text-muted)]"><Icon name="search" /></span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages, accounts, holdings, or actions..." className="h-12 w-full bg-transparent pl-12 pr-14 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" /><kbd className="pointer-events-none absolute right-4 top-3 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">ESC</kbd></div>
        <div className="max-h-[min(58vh,520px)] overflow-y-auto p-2">{groups.map((group) => { const results = filtered.filter((item) => item.group === group); if (!results.length) return null; return <section key={group} className="py-1"><p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{group}</p>{results.map((item) => <button key={item.id} type="button" onClick={() => select(item)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--surface-page)]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"><Icon name={item.icon} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{item.title}</span><span className="block truncate text-xs text-[var(--text-muted)]">{item.detail}</span></span><span className="text-[var(--text-muted)]">→</span></button>)}</section>; })}{filtered.length === 0 && <p className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">No matching pages, records, or actions.</p>}</div>
      </div>
    </div>}
  </>;
}

export function Nav({ profileName = 'Your profile', searchItems = [] }: { profileName?: string; searchItems?: SearchItem[] }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setPending(false); if (timer.current) clearTimeout(timer.current); }, [pathname]);
  const beginNavigation = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (new URL(event.currentTarget.href).pathname === pathname) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPending(true), 180);
  };
  const initials = profileName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const navLink = (link: { href: string; label: string; icon: string }) => {
    const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
    return <Link onClick={beginNavigation} key={link.href} href={link.href} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${active ? 'bg-[var(--color-primary-subtle)] font-semibold text-[var(--color-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-page)] hover:text-[var(--text-primary)]'}`}><span aria-hidden className="grid w-5 place-items-center"><Icon name={link.icon} /></span>{link.label}</Link>;
  };
  return <>
    <aside className="hidden border-r border-[var(--border)] bg-white md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-56 md:flex-col md:px-4 md:py-5">
      <Link href="/dashboard" className="flex items-center gap-3 px-2 text-[var(--text-primary)]" aria-label="Investment Planner home"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-primary)] text-white"><Icon name="compass" /></span><span className="text-[16px] font-bold leading-5 tracking-tight">Investment<br />Planner</span></Link>
      <nav aria-label="Primary navigation" className="mt-6 space-y-1">{LINKS.map(navLink)}<div className="my-5 border-t border-[var(--border)]" />{navLink({ href: '/settings', label: 'Settings', icon: 'settings' })}</nav>
      <div className="mt-auto border-t border-[var(--border)] pt-4">
        <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-[var(--surface-page)]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-xs font-bold text-[var(--color-primary)]">{initials}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">{profileName}</span><span className="text-[var(--text-muted)]"><Icon name="chevron-down" /></span></button>
        {profileOpen && <div role="menu" className="mt-2 rounded-xl border border-[var(--border)] bg-white p-1 shadow-[var(--shadow-modal)]"><button role="menuitem" type="button" onClick={async () => { await clientSupabase().auth.signOut(); window.location.href = '/login'; }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--text-body)] hover:bg-[var(--surface-page)]">Sign out</button></div>}
      </div>
    </aside>
    <header className="sticky top-0 z-20 bg-[var(--surface-page)]/95 px-4 py-3 backdrop-blur md:fixed md:left-56 md:right-0 md:flex md:h-[75px] md:items-center md:px-10 md:py-0">
      <div className="flex w-full flex-wrap items-center gap-3 md:flex-nowrap"><Link href="/dashboard" className="flex items-center gap-2 md:hidden"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-primary)] text-white"><Icon name="compass" /></span><span className="text-sm font-bold text-[var(--text-primary)]">Investment Planner</span></Link><button type="button" className="ml-auto text-sm text-[var(--text-muted)] md:hidden" onClick={async () => { await clientSupabase().auth.signOut(); window.location.href = '/login'; }}>Sign out</button><div className="order-3 w-full md:order-none md:flex-1"><SearchCommand items={searchItems} /></div></div>
      <nav aria-label="Mobile navigation" className="mt-3 flex w-full gap-1 overflow-x-auto md:hidden">{LINKS.map(navLink)}{navLink({ href: '/settings', label: 'Settings', icon: 'settings' })}</nav>
      {pending && <p className="absolute right-9 top-[62px] flex items-center gap-2 text-xs text-[var(--text-muted)]" role="status" aria-live="polite"><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />Loading…</p>}
    </header>
  </>;
}
