import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getEtfAllocations, getFxPrefs, getOrCreateProfile, listInstruments } from '@/lib/db/queries';
import { computePlan } from '@/lib/engine/plan';
import { toPlanInput } from '@/lib/plan-input';
import { getHistory } from '@/lib/market/yahoo';
import { ProjectionsClient } from '@/components/projections-client';
import { BankComparison } from '@/components/bank-comparison';
import { AccountPolicyCard } from '@/components/account-policy-card';

export const dynamic = 'force-dynamic';

export default async function ProjectionsPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments, fxPrefs] = await Promise.all([getOrCreateProfile(db, user.id), getAccountAllocations(db, user.id), getEtfAllocations(db, user.id), listInstruments(db), getFxPrefs(db, user.id)]);
  const plan = computePlan(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
  const initialMonthly = Math.max(plan.surplus, 0);
  const accountMonthly = { TFSA: plan.accounts.find((a) => a.key === 'TFSA')?.effective ?? 0, RRSP: plan.accounts.find((a) => a.key === 'RRSP')?.effective ?? 0 };
  const cashMonthly = plan.accounts.find((a) => a.key === 'CASH')?.effective ?? 0;
  const selections = [...new Set(plan.purchases.map((p) => p.instrument.ticker))].map((ticker) => ({ ticker, pct: plan.purchases.filter((p) => p.instrument.ticker === ticker).reduce((s, p) => s + p.cadAmount, 0) }));
  const selectionTotal = selections.reduce((s, x) => s + x.pct, 0);
  const defaultInstrument = instruments.find((i) => i.ticker === 'XEQT.TO') ?? instruments[0];
  let points: { date: string; close: number }[] = [];
  if (defaultInstrument) { try { points = await getHistory(defaultInstrument.ticker, '5y'); } catch { /* Market data is optional; client can retry. */ } }
  return <div><h1 className="text-2xl font-semibold tracking-tight">Projections</h1><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Explore long-term growth assumptions and historical dollar-cost averaging.</p><div className="mt-6"><AccountPolicyCard tfsaRoom={profile.tfsa_room} rrspRoom={profile.rrsp_room} tfsaMonthly={accountMonthly.TFSA} rrspMonthly={accountMonthly.RRSP} cashMonthly={cashMonthly} /></div><ProjectionsClient instruments={instruments} initialTicker={defaultInstrument?.ticker ?? ''} initialPoints={points} initialMonthly={initialMonthly} accountMonthly={accountMonthly} accountRooms={{ TFSA: profile.tfsa_room, RRSP: profile.rrsp_room }} cashMonthly={cashMonthly} selections={selections.map((s) => ({ ticker: s.ticker, pct: selectionTotal ? s.pct / selectionTotal : 0 }))} /><div className="mt-6"><BankComparison /></div></div>;
}
