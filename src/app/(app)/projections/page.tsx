import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getEtfAllocations, getFxPrefs, getOrCreateProfile, listInstruments } from '@/lib/db/queries';
import { computePlan } from '@/lib/engine/plan';
import { toPlanInput } from '@/lib/plan-input';
import { getHistory } from '@/lib/market/yahoo';
import { ProjectionsClient } from '@/components/projections-client';

export const dynamic = 'force-dynamic';

export default async function ProjectionsPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments, fxPrefs] = await Promise.all([getOrCreateProfile(db, user.id), getAccountAllocations(db, user.id), getEtfAllocations(db, user.id), listInstruments(db), getFxPrefs(db, user.id)]);
  const plan = computePlan(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
  const initialMonthly = Math.max(plan.surplus, 0);
  const defaultInstrument = instruments.find((i) => i.ticker === 'XEQT.TO') ?? instruments[0];
  let points: { date: string; close: number }[] = [];
  if (defaultInstrument) { try { points = await getHistory(defaultInstrument.ticker, '5y'); } catch { /* Market data is optional; client can retry. */ } }
  return <div><h1 className="text-2xl font-semibold tracking-tight">Projections</h1><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Explore long-term growth assumptions and historical dollar-cost averaging.</p><ProjectionsClient instruments={instruments} initialTicker={defaultInstrument?.ticker ?? ''} initialPoints={points} initialMonthly={initialMonthly} /></div>;
}
