import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getContributions, getEtfAllocations, getFxPrefs, getHoldings, getCycles, getOrCreateProfile, getSchedule, listInstruments } from '@/lib/db/queries';
import { buildInstalment } from '@/lib/engine/schedule';
import { settleDueCycles } from '@/lib/schedule/settle';
import { ContributionSchedule } from '@/components/contribution-schedule';
import { computePlan } from '@/lib/engine/plan';
import { toPlanInput } from '@/lib/plan-input';
import { getQuotes } from '@/lib/market/yahoo';
import { holdingValueCad, valuationTickers } from '@/lib/valuation';
import { FinancialBaseline, PlannedPurchases } from '@/components/forms/plan-inputs';
import { PlanWorkspace } from '@/components/forms/plan-form';

export const dynamic = 'force-dynamic';

export default async function PlanPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  await settleDueCycles(db, user.id);
  const [profile, accountAlloc, etfAlloc, instruments, contributions, fxPrefs, holdings, schedule, cycles] = await Promise.all([
    getOrCreateProfile(db, user.id), getAccountAllocations(db, user.id), getEtfAllocations(db, user.id), listInstruments(db),
    getContributions(db, user.id), getFxPrefs(db, user.id), getHoldings(db, user.id), getSchedule(db, user.id), getCycles(db, user.id),
  ]);
  const planInput = toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs);
  const plan = computePlan(planInput);
  const tickers = valuationTickers(holdings);
  let quotes: Record<string, { price: number; currency: string }> = {};
  if (tickers.length) { try { quotes = await getQuotes(tickers); } catch { /* Quotes enrich the starting value but are optional. */ } }
  const portfolioValue = holdings.reduce((sum, holding) => sum + holdingValueCad(holding, quotes), 0);
  return <PlanWorkspace schedule={<ContributionSchedule key={schedule?.next_due ?? 'new'} userId={user.id} schedule={schedule} cycles={cycles} instalment={buildInstalment(planInput)} />} key={JSON.stringify([profile.monthly_income,profile.monthly_expenses,accountAlloc])} baseline={<FinancialBaseline key={JSON.stringify(profile)} userId={user.id} profile={profile} />} purchases={<PlannedPurchases key={JSON.stringify(etfAlloc)} userId={user.id} allocations={etfAlloc} instruments={instruments} accountAlloc={accountAlloc} surplus={Math.max(0,plan.surplus)} />} userId={user.id} month={new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'America/Toronto' }).format(new Date())} monthlySurplus={Math.max(0, plan.surplus)} accountAlloc={accountAlloc} contributions={contributions.map((contribution) => ({ account: contribution.account, amount: contribution.amount_cad, date: contribution.contributed_on }))} portfolioValue={portfolioValue} tfsaRoom={profile.tfsa_room} rrspRoom={profile.rrsp_room} />;
}
