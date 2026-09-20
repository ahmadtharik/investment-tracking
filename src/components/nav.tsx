'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { clientSupabase } from '@/lib/supabase/client';

const LINKS = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/plan', label: 'Plan', icon: 'plan' },
  { href: '/portfolio', label: 'Portfolio', icon: 'portfolio' },
  { href: '/accounts', label: 'Accounts', icon: 'accounts' },
  { href: '/projections', label: 'Projections', icon: 'projections' },
] as const;

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M9 20v-6h6v6" /></>,
    plan: <><circle cx="12" cy="12" r="8" /><path d="M12 8v8m-4-4h8" /></>,
    portfolio: <><path d="M4 18V6m0 12h16" /><path d="m7 14 3-3 3 2 5-6" /></>,
    accounts: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></>,
    projections: <><path d="M5 19 19 5M10 5h9v9" /><path d="M5 8v11h11" /></>,
    settings: <><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" /><path d="m19.4 15 .1.1-1.5 2.6-.2-.1a2 2 0 0 0-2.1.1l-.2.1a2 2 0 0 0-1 1.8v.2h-3v-.2a2 2 0 0 0-1.1-1.8l-.2-.1a2 2 0 0 0-2.1-.1l-.2.1-1.5-2.6.1-.1a2 2 0 0 0 .9-1.9v-.2a2 2 0 0 0-.9-1.8l-.1-.1 1.5-2.6.2.1a2 2 0 0 0 2.1-.1l.2-.1a2 2 0 0 0 1.1-1.8V6h3v.2a2 2 0 0 0 1 1.8l.2.1a2 2 0 0 0 2.1.1l.2-.1 1.5 2.6-.1.1a2 2 0 0 0-.9 1.8v.2a2 2 0 0 0 .9 1.9Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4m8-4v4M4 10h16" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8ZM10 21h4" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 4-4 2 2-4z" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{paths[name] ?? paths.home}</svg>;
}

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
        <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu" className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-[var(--surface-page)]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-xs font-bold text-[var(--color-primary)]">{initials}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">{profileName}</span><span className="text-[var(--text-muted)]"><Icon name="chevron" /></span></button>
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
