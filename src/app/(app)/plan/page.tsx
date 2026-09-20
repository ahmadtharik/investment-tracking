import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getContributions, getEtfAllocations, getFxPrefs, getHoldings, getOrCreateProfile, listInstruments } from '@/lib/db/queries';
import { computePlan } from '@/lib/engine/plan';
import { toPlanInput } from '@/lib/plan-input';
import { getQuotes } from '@/lib/market/yahoo';
import { FinancialBaseline, PlannedPurchases } from '@/components/forms/plan-inputs';
import { PlanWorkspace } from '@/components/forms/plan-form';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments, contributions, fxPrefs, holdings] = await Promise.all([
    getOrCreateProfile(db, user.id), getAccountAllocations(db, user.id), getEtfAllocations(db, user.id), listInstruments(db),
    getContributions(db, user.id), getFxPrefs(db, user.id), getHoldings(db, user.id),
  ]);
  const plan = computePlan(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
  const tickers = [...new Set(holdings.map((holding) => holding.ticker).filter(Boolean))];
  let quotes: Record<string, { price: number; currency: string }> = {};
  if (tickers.length) { try { quotes = await getQuotes(tickers); } catch { /* Quotes enrich the starting value but are optional. */ } }
  const portfolioValue = holdings.reduce((sum, holding) => {
    const quote = quotes[holding.ticker];
    const native = quote && holding.units > 0 ? holding.units * quote.price : holding.balance_native;
    return sum + (holding.currency === 'USD' ? native * holding.fx_rate : native);
  }, 0);
  return <PlanWorkspace key={JSON.stringify([profile.monthly_income,profile.monthly_expenses,accountAlloc])} baseline={<FinancialBaseline key={JSON.stringify(profile)} userId={user.id} profile={profile} />} purchases={<PlannedPurchases key={JSON.stringify(etfAlloc)} userId={user.id} allocations={etfAlloc} instruments={instruments} accountAlloc={accountAlloc} surplus={Math.max(0,plan.surplus)} />} userId={user.id} month={new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' }).format(new Date())} monthlySurplus={Math.max(0, plan.surplus)} accountAlloc={accountAlloc} contributions={contributions.map((contribution) => ({ account: contribution.account, amount: contribution.amount_cad, date: contribution.contributed_on }))} portfolioValue={portfolioValue} tfsaRoom={profile.tfsa_room} rrspRoom={profile.rrsp_room} />;
}
