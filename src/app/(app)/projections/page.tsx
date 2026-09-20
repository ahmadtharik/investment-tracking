import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getEtfAllocations, getFxPrefs, getHoldings, getOrCreateProfile, listInstruments } from '@/lib/db/queries';
import { computePlan } from '@/lib/engine/plan';
import { toPlanInput } from '@/lib/plan-input';
import { getQuotes } from '@/lib/market/yahoo';
import { ProjectionsClient } from '@/components/projections-client';

export const dynamic = 'force-dynamic';

export default async function ProjectionsPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments, fxPrefs, holdings] = await Promise.all([getOrCreateProfile(db, user.id), getAccountAllocations(db, user.id), getEtfAllocations(db, user.id), listInstruments(db), getFxPrefs(db, user.id), getHoldings(db, user.id)]);
  const plan = computePlan(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
  const initialMonthly = Math.max(plan.surplus, 0);
  const accountMonthly = { TFSA: plan.accounts.find((a) => a.key === 'TFSA')?.effective ?? 0, RRSP: plan.accounts.find((a) => a.key === 'RRSP')?.effective ?? 0 };
  const cashMonthly = plan.accounts.find((a) => a.key === 'CASH')?.effective ?? 0;
  const selections = [...new Set(plan.purchases.map((p) => p.instrument.ticker))].map((ticker) => ({ ticker, pct: plan.purchases.filter((p) => p.instrument.ticker === ticker).reduce((s, p) => s + p.cadAmount, 0) }));
  const selectionTotal = selections.reduce((s, x) => s + x.pct, 0);
  const defaultInstrument = instruments.find((i) => i.ticker === 'XEQT.TO') ?? instruments[0];
  let points: { date: string; close: number }[] = [];
  let quotes: Record<string, { price: number }> = {};
  try { quotes = await getQuotes([...new Set(holdings.map((holding) => holding.ticker))]); } catch { /* Saved balances remain the fallback. */ }
  const initialStarting = holdings.reduce((sum, holding) => {
    const native = quotes[holding.ticker]?.price && holding.units > 0 ? holding.units * quotes[holding.ticker].price : holding.balance_native;
    return sum + native * (holding.currency === 'USD' ? holding.fx_rate : 1);
  }, 0);
  return <div className="mx-auto w-full max-w-[1276px]"><h1 className="text-[28px] font-bold tracking-tight">Projections</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Explore long-term growth based on your plan.</p><ProjectionsClient instruments={instruments} initialTicker={defaultInstrument?.ticker ?? ''} initialPoints={points} initialMonthly={initialMonthly} initialStarting={initialStarting} accountMonthly={accountMonthly} accountRooms={{ TFSA: profile.tfsa_room, RRSP: profile.rrsp_room }} cashMonthly={cashMonthly} selections={selections.map((s) => ({ ticker: s.ticker, pct: selectionTotal ? s.pct / selectionTotal : 0 }))} /></div>;
}
