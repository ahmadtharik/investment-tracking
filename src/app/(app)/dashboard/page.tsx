import Link from 'next/link';
import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getContributions, getEtfAllocations, getFxPrefs, getHoldings, getOrCreateProfile, listInstruments } from '@/lib/db/queries';
import { computePlan } from '@/lib/engine/plan';
import { futureValue } from '@/lib/engine/projection';
import { toPlanInput } from '@/lib/plan-input';
import { getQuotes } from '@/lib/market/yahoo';
import { Card } from '@/components/ui/card';
import { DashboardGrowthCard } from '@/components/dashboard/growth-card';
import { AssetAllocationDonut, type AssetAllocationDatum } from '@/components/dashboard/asset-allocation-donut';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { formatCAD, formatPct } from '@/lib/format';

export const dynamic = 'force-dynamic';

const ACCOUNT_NAMES: Record<string, string> = { TFSA: 'TFSA', RRSP: 'RRSP', CASH: 'Cash' };
const ACCOUNT_COLORS: Record<string, string> = { TFSA: '#2563EB', RRSP: '#F97316', CASH: '#22C55E' };
const CHART_COLORS = ['#2563EB', '#F97316', '#22C55E', '#8B5CF6', '#06B6D4'];

function InlineIcon({ kind, bare = false, tone = 'blue' }: { kind: 'portfolio' | 'invested' | 'room' | 'savings' | 'account' | 'activity' | 'bulb'; bare?: boolean; tone?: 'blue' | 'orange' | 'green' }) {
  const shapes = {
    portfolio: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /><path d="m3 16 5-5 4 2 7-8" /></>,
    invested: <><path d="M5 7h14v11H5z" /><path d="M8 7V5h8v2M8 12h8" /></>,
    room: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 4v2m8 6h-2m-6 8v-2m-8-6h2" /></>,
    savings: <><path d="M12 3v18M17 7.5c0-1.4-1.8-2.5-4-2.5S9 6.1 9 7.5 10.6 10 13 10s4 1.1 4 2.5S15.2 15 13 15s-4-1.1-4-2.5" /></>,
    account: <><rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 9h6M9 13h4" /></>,
    activity: <><path d="M5 12h3l2-5 3 10 2-5h4" /></>,
    bulb: <><path d="M9 18h6M10 21h4" /><path d="M8.5 14.5a6 6 0 1 1 7 0c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z" /></>,
  };
  const icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{shapes[kind]}</svg>;
  const tones = { blue: 'bg-[var(--color-primary-subtle)] text-[var(--color-primary)]', orange: 'bg-orange-50 text-orange-500', green: 'bg-emerald-50 text-emerald-600' };
  return bare ? icon : <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tones[tone]}`}>{icon}</span>;
}

function KpiIcon({ kind }: { kind: 'portfolio' | 'invested' | 'room' | 'savings' }) {
  return <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"><InlineIcon kind={kind} bare /></span>;
}

export default async function DashboardPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments, contributions, fxPrefs, holdings] = await Promise.all([
    getOrCreateProfile(db, user.id),
    getAccountAllocations(db, user.id),
    getEtfAllocations(db, user.id),
    listInstruments(db),
    getContributions(db, user.id),
    getFxPrefs(db, user.id),
    getHoldings(db, user.id),
  ]);
  const plan = computePlan(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' }).format(now);
  const firstName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'there').toString().trim().split(/\s+/)[0];
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const investedThisMonth = contributions.filter((contribution) => contribution.contributed_on.slice(0, 7) === monthKey).reduce((sum, contribution) => sum + contribution.amount_cad, 0);
  const contributionRoom = Math.max(0, profile.tfsa_room) + Math.max(0, profile.rrsp_room);
  const tickers = [...new Set(holdings.map((holding) => holding.ticker).filter(Boolean))];
  let quotes: Record<string, { price: number; currency: string }> = {};
  if (tickers.length) { try { quotes = await getQuotes(tickers); } catch { /* market quotes are optional */ } }
  const holdingValues = holdings.map((holding) => {
    const quote = quotes[holding.ticker];
    const native = quote && holding.units > 0 ? holding.units * quote.price : holding.balance_native;
    return { ...holding, valueCad: holding.currency === 'USD' ? native * holding.fx_rate : native };
  });
  const portfolioValue = holdingValues.reduce((sum, holding) => sum + holding.valueCad, 0);
  const allocationMap = new Map<string, { name: string; value: number }>();
  holdingValues.forEach((holding) => {
    const key = holding.ticker || holding.name || 'Unlabelled holding';
    const current = allocationMap.get(key);
    allocationMap.set(key, { name: current?.name || holding.name || key, value: (current?.value ?? 0) + holding.valueCad });
  });
  const assetAllocation: AssetAllocationDatum[] = [...allocationMap.entries()].sort((a, b) => b[1].value - a[1].value).map(([key, item], index) => ({ key, value: item.value, name: key === item.name ? key : `${key} · ${item.name}`, color: CHART_COLORS[index % CHART_COLORS.length] }));
  const planPcts = new Map(accountAlloc.map((allocation) => [allocation.account, allocation.pct]));
  const planTotal = plan.accounts.reduce((sum, account) => sum + account.effective, 0);
  const planPercent = plan.surplus > 0 ? planTotal / plan.surplus : 0;
  const unallocated = Math.max(0, Math.max(plan.surplus, 0) - planTotal);
  const projectionInput = { starting: Math.max(0, portfolioValue), monthlyContribution: Math.max(0, plan.surplus), annualReturn: 0.07, contributionFrequency: 'monthly' as const };
  const tenYear = futureValue(projectionInput, 10);
  const status = planTotal <= 0 ? 'neutral' : investedThisMonth >= planTotal ? 'on-track' : 'behind';
  const savingsCopy = profile.monthly_income > 0
    ? plan.surplus >= 0 ? `You're saving ${formatPct(plan.savingsRate)} of your income. Keep it up!` : `Your expenses are ${formatCAD(Math.abs(plan.surplus))} above income this month.`
    : 'Add your income to see your savings rate.';
  const recentActivity = contributions.slice(-3).reverse();
  const configuredAccounts = plan.accounts.filter((account) => planPcts.has(account.key) || account.effective > 0);
  const profileName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Your profile').toString();

  return <div className="dashboard-main mx-auto w-full max-w-[1248px]">
    <section className="relative h-auto min-h-[156px] overflow-hidden rounded-[14px] border border-blue-100 bg-[#dbeafe] px-6 py-5 sm:py-6">
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(239,246,255,.94)_0%,rgba(239,246,255,.68)_42%,rgba(219,234,254,.08)_100%),url('/images/dashboard-mountains.png')] bg-cover bg-[right_center]" />
      <div className="relative flex min-h-[108px] flex-col justify-center gap-4 pr-0 sm:pr-[300px]">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Your financial overview</p><DashboardGreeting firstName={firstName} savingsCopy={savingsCopy} /></div>
      </div>
      <div className="relative mt-4 w-full rounded-xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-sm sm:absolute sm:right-5 sm:top-[46px] sm:mt-0 sm:w-[338px]"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${status === 'on-track' ? 'bg-emerald-500' : status === 'behind' ? 'bg-amber-500' : 'bg-slate-400'}`} /><p className="text-sm font-bold text-[var(--text-primary)]">{status === 'on-track' ? 'On track' : status === 'behind' ? 'Review your plan' : 'Plan your next step'}</p><Link href="/plan" aria-label="Review monthly plan" className="ml-auto rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-page)]">→</Link></div><p className="mt-1 text-xs leading-5 text-[var(--text-body)]">{status === 'on-track' ? `At your current pace, you could reach ${formatCAD(tenYear.value)} in 10 years.` : status === 'behind' ? `${formatCAD(Math.max(planTotal - investedThisMonth, 0))} remains in this month's plan.` : 'Set a monthly plan to track progress here.'}</p></div>
    </section>

    <section aria-label="Dashboard metrics" className="mt-[14px] grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="flex h-[124px] items-start gap-5 rounded-[14px] border border-[var(--border)] bg-white px-6 py-4 shadow-[var(--shadow-card)]"><KpiIcon kind="portfolio" /><div className="min-w-0"><p className="text-sm font-medium text-[var(--text-muted)]">Portfolio value</p><p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{formatCAD(portfolioValue)}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">Performance data unavailable</p></div></article>
      <article className="flex h-[124px] items-start gap-5 rounded-[14px] border border-[var(--border)] bg-white px-6 py-4 shadow-[var(--shadow-card)]"><KpiIcon kind="invested" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-[var(--text-muted)]">Invested this month</p><p className="mt-1 whitespace-nowrap text-2xl font-bold tabular-nums text-[var(--text-primary)]">{formatCAD(investedThisMonth)} <span className="text-base font-semibold text-[var(--text-body)]">/ {formatCAD(planTotal)}</span></p><div className="mt-2 flex items-center gap-2"><div className="h-2 w-36 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${planTotal > 0 ? Math.min(100, investedThisMonth / planTotal * 100) : 0}%` }} /></div><span className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">{planTotal > 0 ? formatPct(investedThisMonth / planTotal) : '—'}</span></div></div></article>
      <article className="flex h-[124px] items-start gap-5 rounded-[14px] border border-[var(--border)] bg-white px-6 py-4 shadow-[var(--shadow-card)]"><KpiIcon kind="room" /><div className="min-w-0"><p className="text-sm font-medium text-[var(--text-muted)]">Contribution room</p><p className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{formatCAD(contributionRoom)}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">TFSA {formatCAD(Math.max(0, profile.tfsa_room))} · RRSP {formatCAD(Math.max(0, profile.rrsp_room))}</p></div></article>
      <article className="flex h-[124px] items-start gap-5 rounded-[14px] border border-[var(--border)] bg-white px-6 py-4 shadow-[var(--shadow-card)]"><KpiIcon kind="savings" /><div className="min-w-0"><p className="text-sm font-medium text-[var(--text-muted)]">Savings rate</p><p className={`mt-1 text-2xl font-bold tabular-nums ${plan.surplus < 0 ? 'text-amber-600' : 'text-[var(--text-primary)]'}`}>{profile.monthly_income > 0 ? formatPct(plan.savingsRate) : '—'}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{profile.monthly_income > 0 ? 'of your income' : 'Income not set'}</p></div></article>
    </section>

    <div className="mt-3 flex flex-wrap gap-2 rounded-[14px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-card)]" aria-label="Quick actions">
      <span className="mr-1 self-center text-sm font-bold text-[var(--text-primary)]">Quick actions</span>
      <Link href="/accounts/manage#record-contribution" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100">＋ Record contribution</Link>
      <Link href="/plan" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100">☷ Adjust plan</Link>
      <Link href="/portfolio#holding-editor" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100">＋ Add holding</Link>
      <Link href="/accounts/manage#contribution-room" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100">◉ Review account room</Link>
    </div>

    <section className="mt-4 grid items-stretch gap-4 xl:grid-cols-[410px_minmax(0,1fr)_305px]">
      <Card className="min-h-[358px] !p-5 xl:h-[358px]"><header className="flex items-start justify-between gap-3"><h2 className="text-[20px] font-bold text-[var(--text-primary)]">Your monthly plan</h2><Link href="/plan" className="rounded-lg bg-[var(--color-primary-subtle)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]">Edit plan</Link></header>{configuredAccounts.length === 0 ? <p className="mt-10 rounded-xl bg-[var(--surface-page)] px-3 py-8 text-center text-sm text-[var(--text-muted)]">No monthly allocation yet. Set one up in Plan.</p> : <div className="mt-8 space-y-5">{configuredAccounts.map((account) => { const pct = planPcts.get(account.key) ?? (plan.surplus > 0 ? account.raw / plan.surplus : 0); const tone = account.key === 'RRSP' ? 'orange' : account.key === 'CASH' ? 'green' : 'blue'; return <div key={account.key} className="grid grid-cols-[40px_62px_minmax(0,1fr)_34px] items-center gap-3"><InlineIcon kind="account" tone={tone} /><span className="text-sm font-semibold text-[var(--text-primary)]">{ACCOUNT_NAMES[account.key]}</span><div><span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{formatCAD(account.effective)}</span><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, backgroundColor: ACCOUNT_COLORS[account.key] }} /></div></div><span className="text-right text-sm tabular-nums text-[var(--text-muted)]">{formatPct(pct)}</span></div>; })}</div>}<footer className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-3 text-sm"><span className="font-semibold text-[var(--text-primary)]">Total</span><span className="font-bold tabular-nums text-[var(--text-primary)]">{formatCAD(planTotal)} <span className="ml-6">{plan.surplus > 0 ? formatPct(planPercent) : '—'}</span></span></footer>{unallocated > 0.5 && <p className="mt-2 text-right text-[11px] text-[var(--text-muted)]">Unallocated {formatCAD(unallocated)}</p>}</Card>
      <DashboardGrowthCard startingValue={portfolioValue} monthlyContribution={Math.max(plan.surplus, 0)} />
      <Card className="min-h-[358px] !p-5 xl:h-[358px]"><header><h2 className="text-[20px] font-bold text-[var(--text-primary)]">Asset allocation</h2></header><div className="mt-3"><AssetAllocationDonut data={assetAllocation} /></div></Card>
    </section>

    <section className="mt-5 grid items-stretch gap-4 xl:grid-cols-[426px_minmax(0,1fr)_305px]">
      <Card className="min-h-[214px] !p-5 xl:h-[214px]"><header className="flex items-center justify-between"><h2 className="text-[18px] font-bold text-[var(--text-primary)]">Recent activity</h2><Link href="/accounts" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">View all</Link></header>{recentActivity.length ? <ul className="mt-2 divide-y divide-[var(--border)]">{recentActivity.map((contribution) => <li key={contribution.id} className="flex items-center gap-3 py-2"><InlineIcon kind="activity" tone={contribution.account === 'RRSP' ? 'orange' : contribution.account === 'CASH' ? 'green' : 'blue'} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[var(--text-primary)]">{ACCOUNT_NAMES[contribution.account] ?? contribution.account} <span className="font-normal text-[var(--text-muted)]">contribution</span></span><span className="block text-[11px] text-[var(--text-muted)]">{new Date(`${contribution.contributed_on}T12:00:00`).toLocaleDateString('en-CA')}</span></span><span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600">+{formatCAD(contribution.amount_cad)}</span></li>)}</ul> : <p className="mt-8 text-center text-sm text-[var(--text-muted)]">No contributions yet. Log one in Accounts to see activity.</p>}</Card>
      <Card className="min-h-[214px] !p-5 xl:h-[214px]"><header className="flex items-center justify-between"><h2 className="text-[18px] font-bold text-[var(--text-primary)]">Goals</h2><Link href="/projections" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">View all</Link></header><div className="mt-3 grid gap-3 sm:grid-cols-2">{[{ title: 'Monthly plan', detail: planTotal > 0 ? `${formatCAD(planTotal)} planned` : 'No plan configured', progress: planTotal > 0 ? Math.min(100, planPercent * 100) : 0, href: '/plan' }, { title: '10-year projection', detail: `${formatCAD(tenYear.value)} estimated`, progress: portfolioValue > 0 ? Math.min(100, tenYear.value / Math.max(portfolioValue * 2, 1) * 100) : 0, href: '/projections' }].map((goal) => <Link key={goal.title} href={goal.href} className="min-h-[142px] rounded-xl border border-[var(--border)] bg-white p-3 hover:border-blue-200 hover:bg-blue-50"><div className="flex items-center gap-2"><InlineIcon kind="account" /><p className="text-sm font-semibold text-[var(--text-primary)]">{goal.title}</p></div><p className="mt-2 text-xs text-[var(--text-muted)]">{goal.detail}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${goal.progress}%` }} /></div><p className="mt-1 text-right text-[10px] font-semibold text-[var(--text-muted)]">{goal.title === 'Monthly plan' && planTotal > 0 ? `${formatPct(planPercent)} allocated` : 'Estimate only'}</p></Link>)}</div></Card>
      <aside className="flex min-h-[214px] flex-col items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-primary-subtle)] p-5 text-center xl:h-[214px]"><InlineIcon kind="bulb" /><h2 className="mt-3 text-[18px] font-bold text-[var(--text-primary)]">{status === 'on-track' ? "You're on track!" : status === 'behind' ? 'A little behind' : 'Make a plan'}</h2><p className="mt-1 max-w-[230px] text-xs leading-5 text-[var(--text-body)]">{status === 'on-track' ? `${formatCAD(investedThisMonth)} invested of ${formatCAD(planTotal)} planned this month.` : status === 'behind' ? `${formatCAD(Math.max(planTotal - investedThisMonth, 0))} left to invest this month.` : 'Choose a monthly allocation to track your progress.'}</p><Link href="/plan" aria-label="Open monthly plan" className="mt-2 rounded-lg p-1 text-[var(--color-primary)] hover:bg-white">→</Link></aside>
    </section>
  </div>;
}
