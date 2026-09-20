import Link from 'next/link';
import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getOrCreateProfile, getContributions, getWithdrawals, getAccountAllocations } from '@/lib/db/queries';
import { Card } from '@/components/ui/card';
import { RoomForm } from '@/components/forms/room-form';
import { ContributionForm } from '@/components/forms/contribution-form';
import { WithdrawalForm } from '@/components/forms/withdrawal-form';
import { ExtraCashScenario } from '@/components/extra-cash-scenario';
import { EditorLinks } from '@/components/editor-links';

export const dynamic = 'force-dynamic';

export default async function ManageAccountsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, contributions, withdrawals, allocations, query] = await Promise.all([
    getOrCreateProfile(db,user.id),getContributions(db,user.id),getWithdrawals(db,user.id),getAccountAllocations(db,user.id),searchParams,
  ]);
  const initialAccount = query.account === 'RRSP' || query.account === 'CASH' ? query.account : 'TFSA';
  const surplus = Math.max(0,(profile.monthly_income??0)-(profile.monthly_expenses??0));
  return <div className="w-full pb-8"><EditorLinks /><Link href="/accounts" className="text-xs font-semibold text-[var(--color-primary)]">← Accounts overview</Link><h1 className="mt-3 text-[28px] font-bold tracking-tight text-[var(--text-primary)]">Manage accounts</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Keep your available room and actual account activity up to date.</p>
    <nav aria-label="Account management sections" className="mt-5 flex gap-2 overflow-x-auto whitespace-nowrap border-b border-[var(--border)] pb-3 text-xs font-semibold">{[['Contribution room','#contribution-room'],['Record contribution','#record-contribution'],['TFSA withdrawals','#withdrawals']].map(([label,href])=><a key={href} href={href} className="rounded-lg border border-blue-100 bg-[var(--color-primary-subtle)] px-4 py-2 text-[var(--color-primary)]">{label}</a>)}</nav>
    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="space-y-4"><section id="contribution-room" className="scroll-mt-24"><Card title="Contribution room" description="Your verified available room today, not the annual limit. Recorded contributions reduce these values."><RoomForm userId={user.id} profile={profile} /></Card></section><Card className="!bg-[var(--color-primary-subtle)]"><h2 className="text-sm font-semibold">Looking to change your monthly plan?</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Income, expenses, account allocations, and planned purchases live in Plan. These account tools record what has actually happened.</p><Link href="/plan#financial-baseline" className="mt-3 inline-block text-xs font-semibold text-[var(--color-primary)]">Open your plan →</Link></Card></div>
      <section id="record-contribution" className="scroll-mt-24"><Card title="Record a contribution" description="Log a deposit you have already made. This does not transfer money or place a trade."><ContributionForm userId={user.id} contributions={contributions} initialAccount={initialAccount} /></Card></section>
    </div>
    <section id="withdrawals" className="mt-4 scroll-mt-24"><Card title="TFSA withdrawals" description="Keep a record of withdrawals and their expected room-restoration year. These entries do not automatically adjust your saved room."><WithdrawalForm userId={user.id} withdrawals={withdrawals.filter(w=>w.account==='TFSA')} /></Card></section>
    <details className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5"><summary className="cursor-pointer text-sm font-semibold">Explore a one-time cash scenario</summary><ExtraCashScenario tfsaRoom={profile.tfsa_room} rrspRoom={profile.rrsp_room} tfsaMonthly={surplus*(allocations.find(a=>a.account==='TFSA')?.pct??0)} rrspMonthly={surplus*(allocations.find(a=>a.account==='RRSP')?.pct??0)} /></details>
  </div>;
}
