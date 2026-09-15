import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import {
  getAccountAllocations,
  getContributions,
  getEtfAllocations,
  getFxPrefs,
  getOrCreateProfile,
  getWithdrawals,
  listInstruments,
} from '@/lib/db/queries';
import { computePlan, roomAfterContributions } from '@/lib/engine/plan';
import { toPlanInput } from '@/lib/plan-input';
import { getQuotes } from '@/lib/market/yahoo';
import { Card } from '@/components/ui/card';
import { OverviewCards } from '@/components/dashboard/overview-cards';
import { AllocationTable } from '@/components/dashboard/allocation-table';
import { PurchasesTable } from '@/components/dashboard/purchases-table';
import { AnnualView } from '@/components/dashboard/annual-view';
import { AlertsList } from '@/components/dashboard/alerts-list';
import { AllocationDonut, type DonutDatum } from '@/components/dashboard/allocation-donut';
import { ContributionHistory, type HistoryDatum } from '@/components/dashboard/contribution-history';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const ACCOUNT_NAMES: Record<string, string> = { TFSA: 'TFSA', RRSP: 'RRSP', CASH: 'Cash' };

export default async function DashboardPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments, withdrawals, contributions, fxPrefs] =
    await Promise.all([
      getOrCreateProfile(db, user.id),
      getAccountAllocations(db, user.id),
      getEtfAllocations(db, user.id),
      listInstruments(db),
      getWithdrawals(db, user.id),
      getContributions(db, user.id),
      getFxPrefs(db, user.id),
    ]);

  const plan = computePlan(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
  const hasSetup = profile.monthly_income > 0 || profile.monthly_expenses > 0 || accountAlloc.length > 0 || etfAlloc.length > 0;

  // Actual investing done this calendar year.
  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const investedThisYear = contributions
    .filter((c) => c.contributed_on >= yearStart)
    .reduce((t, c) => t + c.amount_cad, 0);

  // TFSA withdrawals from last year restore their room this year.
  const nextYear = now.getFullYear() + 1;
  const tfsaRestorations = withdrawals
    .filter((w) => w.account === 'TFSA' && w.room_restored_in === nextYear)
    .reduce((t, w) => t + w.amount_cad, 0);

  // Live prices for the tickers this month's plan touches (best-effort).
  const tickers = [...new Set(plan.purchases.map((p) => p.instrument.ticker))];
  let quotes: Record<string, { price: number; currency: string }> = {};
  if (tickers.length > 0) {
    try {
      quotes = await getQuotes(tickers);
    } catch {
      // market data unavailable — the page still renders, prices show "n/a"
    }
  }

  // Stacked contribution history, oldest → newest.
  const history: HistoryDatum[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row: HistoryDatum = {
      label: d.toLocaleString('en-CA', { month: 'short', year: '2-digit' }),
      TFSA: 0,
      RRSP: 0,
      CASH: 0,
    };
    for (const c of contributions) {
      if (c.contributed_on.slice(0, 7) !== key) continue;
      if (c.account === 'TFSA' || c.account === 'RRSP' || c.account === 'CASH') row[c.account] += c.amount_cad;
    }
    history.push(row);
  }

  const donutData: DonutDatum[] = plan.accounts.map((a) => ({
    key: a.key,
    name: ACCOUNT_NAMES[a.key],
    value: a.effective,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-[0_12px_40px_rgba(53,48,36,0.06)] motion-safe:animate-[fade-in_420ms_ease-out]">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="text-sm font-medium text-[var(--accent)]">Your plan at a glance</p><h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Make room for what matters.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">A calm view of your monthly surplus, account room, and the next useful decision.</p></div>
          <div className="rounded-2xl bg-[#edf4f8] px-5 py-4 md:min-w-64"><p className="text-xs font-medium uppercase tracking-wide text-[#52758e]">Next action</p><p className="mt-1 text-sm font-medium text-[#244a61]">Review your allocation and room</p><a href="/accounts" className="mt-2 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-2">Open accounts</a></div>
        </div>
      </section>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Where your money goes each month, and how this year is tracking.
      </p>

      {!hasSetup && <Card className="mt-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <h2 className="font-semibold">Set up your numbers</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Add your income, expenses, account split, and ETF choices to turn this dashboard into a personalized plan.</p>
        <Link href="/settings" className="mt-3 inline-flex text-sm font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300">Open Settings</Link>
      </Card>}

      <div className="mt-6">
        <OverviewCards
          income={profile.monthly_income}
          expenses={profile.monthly_expenses}
          surplus={plan.surplus}
          savingsRate={plan.savingsRate}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Recommended allocation" description="Monthly surplus split by account.">
          <AllocationDonut data={donutData} />
        </Card>
        <Card title="Contribution history" description="Logged actual deposits by account over the last 12 months. Add deposits from Accounts; planned allocations are not included.">
          <ContributionHistory data={history} />
        </Card>
      </div>

      <div className="mt-6">
        <AllocationTable plan={plan} />
      </div>

      <div className="mt-6">
        <PurchasesTable plan={plan} quotes={quotes} />
      </div>

      <div className="mt-6">
        <AnnualView
          investedThisYear={investedThisYear}
          projectedAnnual={plan.projectedAnnual}
          roomAfter={{
            TFSA: roomAfterContributions(profile.tfsa_room, plan.projectedAnnual.TFSA, tfsaRestorations),
            RRSP: roomAfterContributions(profile.rrsp_room, plan.projectedAnnual.RRSP),
          }}
          restorations={tfsaRestorations}
        />
      </div>

      <div className="mt-6">
        <AlertsList alerts={plan.alerts} />
      </div>
    </div>
  );
}
