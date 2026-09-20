'use client';

import { ProfileEditor } from '@/components/profile-editor';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AccountAllocRow } from '@/lib/db/queries';

type SettingsHubProps = { userId: string; displayName: string; email: string; accountAlloc: AccountAllocRow[] };

function Icon({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'green' | 'orange' | 'red' }) {
  const tones = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', orange: 'bg-orange-50 text-orange-500', red: 'bg-rose-50 text-rose-500' };
  return <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${tones[tone]}`}>{children}</span>;
}

function Row({ icon, title, copy, trailing, href, onClick, danger = false, compact = false }: { icon: string; title: string; copy?: string; trailing?: React.ReactNode; href?: string; onClick?: () => void; danger?: boolean; compact?: boolean }) {
  const interactive = Boolean(href || onClick);
  const body = <><Icon tone={danger ? 'red' : 'blue'}>{icon}</Icon><span className="min-w-0 flex-1"><b className={`block text-sm ${danger ? 'text-rose-600' : ''}`}>{title}</b>{copy && <small className="mt-0.5 block text-xs leading-4 text-[var(--text-muted)]">{copy}</small>}</span>{trailing ?? (interactive && <span className="text-xl text-[var(--text-muted)]">›</span>)}</>;
  const classes = `flex ${compact ? 'min-h-[48px]' : 'min-h-[58px]'} items-center gap-3 rounded-lg border px-3 py-2 ${danger ? 'border-rose-100 bg-rose-50/40' : 'border-[var(--border)] bg-white'} ${interactive && !danger ? 'hover:border-blue-200 hover:bg-blue-50/30' : ''}`;
  if (href) return <Link href={href} className={classes}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${classes} w-full text-left`}>{body}</button>;
  return <div className={classes}>{body}</div>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-label="Compact table spacing" aria-checked={checked} onClick={onChange} className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></button>;
}

export function SettingsHub({ userId, displayName, email, accountAlloc }: SettingsHubProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [compact, setCompact] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`investment-planner:ui-preferences:${userId}`);
      if (saved) {
        const value = JSON.parse(saved) as { theme?: 'light' | 'dark' | 'system'; notifications?: boolean[]; compact?: boolean };
        if (value.theme) setTheme(value.theme);
        if (typeof value.compact === 'boolean') setCompact(value.compact);
      }
    } catch { /* Local preference storage is optional. */ }
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (preferencesReady) {
      try { window.localStorage.setItem(`investment-planner:ui-preferences:${userId}`, JSON.stringify({ theme, compact })); window.dispatchEvent(new Event('display-preferences-changed')); } catch { setSecurityMessage('Display preferences could not be saved in this browser.'); }
    }
  }, [theme, compact, preferencesReady]);
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'A';
  const planned = [
    { title: 'Monthly plan', copy: `${Math.round((accountAlloc.find((item) => item.account === 'TFSA')?.pct ?? 0) * 100)}% TFSA allocation`, icon: '◉', tone: 'green' as const },
    { title: '10-year projection', copy: 'Review your projected portfolio value', icon: '↗', tone: 'blue' as const },
    { title: 'Contribution room', copy: 'Manage TFSA and RRSP contribution room', icon: '▣', tone: 'orange' as const },
  ];
  return <div className="mt-4 grid gap-3 xl:grid-cols-[1.08fr_1fr_1fr] xl:items-start">
    <div className="space-y-3">
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold">Profile</h2><div className="mt-3 flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-full bg-[#14285d] text-xl font-bold text-white">{initials}</span><span className="min-w-0 flex-1"><b className="block text-sm">{displayName}</b><small className="block truncate text-sm text-[var(--text-muted)]">{email}</small></span></div><ProfileEditor name={displayName} /></section>
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold">Preferences</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Display defaults for this workspace.</p><dl className="mt-3 space-y-3">{[['Currency', 'CAD (Canadian Dollar)'], ['Date format', 'Canadian locale'], ['Number format', '1,234.56'], ['Time horizon (default)', '10 years'], ['Default view', 'Dashboard']].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] items-center gap-3 text-sm"><dt className="text-[var(--text-muted)]">{label}</dt><dd className="rounded-lg border border-[var(--border)] bg-slate-50 px-3 py-2 text-[var(--text-primary)]">{value}</dd></div>)}</dl></section>
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">Goals</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Plan-derived milestones.</p></div><Link href="/projections#milestones" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">View milestones</Link></div><div className="mt-3 space-y-2">{planned.map((item, index) => <Link href={index === 0 ? '/plan' : index === 1 ? '/projections' : '/accounts/manage#contribution-room'} key={item.title} className="flex min-h-[68px] items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2 hover:border-blue-200 hover:bg-blue-50/30"><Icon tone={item.tone}>{item.icon}</Icon><span className="min-w-0 flex-1"><b className="block text-sm">{item.title}</b><small className="block text-xs text-[var(--text-muted)]">{item.copy}</small></span><span className="text-xl text-[var(--text-muted)]">›</span></Link>)}</div></section>
    </div>

    <div className="space-y-3">
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold">Appearance</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Choose how the app looks and feels.</p><div className="mt-3 grid grid-cols-3 gap-2">{([['light', '☀', 'Light'], ['dark', '☾', 'Dark'], ['system', '▣', 'System']] as const).map(([value, icon, label]) => <button type="button" onClick={() => setTheme(value)} key={value} className={`grid min-h-[88px] place-items-center rounded-lg border text-sm font-semibold ${theme === value ? 'border-blue-600 bg-blue-50 text-blue-600 ring-1 ring-blue-600' : 'border-[var(--border)] text-[var(--text-primary)]'}`}><span className="text-2xl">{icon}</span>{label}</button>)}</div></section>
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold">Data & Rules</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Manage how your data is calculated and displayed.</p><div className="mt-3 space-y-2"><Row icon="▦" title="Financial baseline" copy="Manage income, expenses, and emergency fund in Plan" href="/plan#financial-baseline" /><Row icon="▦" title="Planned purchases" copy="Set investment allocations within each account" href="/plan#planned-purchases" /><Row icon="▦" title="Contribution allocations" copy="Set your monthly account allocations" href="/plan" /><Row icon="▦" title="Strategy reference" copy="Review the planning guidelines" href="/rules" /><Row icon="%" title="Return assumptions" copy="Manage expected annual returns" href="/projections" /><Row icon="▤" title="Tax settings" copy="Tax liability is not calculated. Available contribution room is entered in Accounts." /><Row icon="▣" title="Account-aware room policy" copy="Manage available TFSA and RRSP room" href="/accounts/manage#contribution-room" /><Row icon="⛓" title="Foreign exchange" copy="Compare providers and manage conversion preferences" href="/fx" /></div></section>
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold">Application</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Application settings and preferences.</p><div className="mt-3 space-y-2"><Row compact icon="◉" title="Language" trailing={<span className="text-sm text-[var(--text-muted)]">English</span>} /><Row compact icon="↗" title="Default charts view" trailing={<span className="text-sm text-[var(--text-muted)]">Value</span>} /><Row compact icon="⟳" title="Data refresh frequency" trailing={<span className="text-sm text-[var(--text-muted)]">On page load</span>} /><Row compact icon="▤" title="Compact mode" copy="Show more data in tables" trailing={<Toggle checked={compact} onChange={() => setCompact(!compact)} />} /></div></section>
    </div>

    <div className="space-y-3">
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold">Notifications</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Notification delivery is not configured. Reminders and summaries are not currently sent.</p><div className="mt-3 divide-y divide-[var(--border)]">{[['◷', 'Contribution reminders', 'Remind me to make monthly contributions'], ['▣', 'Monthly summary', 'Get a monthly performance summary'], ['♧', 'Goal updates', "Notify me when I'm on track or off track"], ['▤', 'Market news (optional)', 'Receive relevant market updates']].map(([icon, title, copy], index) => <div key={title} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 place-items-center text-lg text-[var(--text-primary)]">{icon}</span><span className="min-w-0 flex-1"><b className="block text-sm">{title}</b><small className="block text-xs text-[var(--text-muted)]">{copy}</small></span><span className="text-xs text-[var(--text-muted)]">Not available</span></div>)}</div></section>
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold">Privacy & Security</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">Manage your data and account security.</p><div className="mt-3 space-y-2"><Row icon="▣" title="Change password" copy="Set a new password for your account." href="/update-password" /><Row icon="◇" title="Two-factor authentication" copy="Not available for this workspace yet." trailing={<span className="text-sm text-[var(--text-muted)]">Unavailable</span>} /><a href="/api/account/export" download className="block rounded-lg border border-[var(--border)] p-3 text-sm font-semibold text-blue-600">Download my data (JSON)</a><Row icon="♲" title="Delete my data" copy="Deletion is unavailable until a confirmed, recoverable workflow is implemented." danger trailing={<span className="text-sm text-rose-600">Unavailable</span>} /></div>{securityMessage && <p role="status" className="mt-3 text-sm text-[var(--text-muted)]">{securityMessage}</p>}</section>
      <section className="rounded-[var(--radius-card)] border border-rose-100 bg-rose-50/70 p-4 shadow-[var(--shadow-card)]"><h2 className="text-base font-semibold text-rose-800">Danger zone</h2><p className="mt-0.5 text-sm text-rose-700">Destructive actions are deliberately unavailable until they can be confirmed and recovered safely.</p><div className="mt-3"><Row icon="♲" title="Reset all data" copy="Unavailable" danger trailing={<span className="text-sm text-rose-600">Unavailable</span>} /></div></section>
    </div>


  </div>;
}
