import { authGuard } from "@/lib/supabase/middleware";
import { serverSupabase } from "@/lib/supabase/server";
import {
  getAccountAllocations,
  getContributions,
  getEtfAllocations,
  getFxPrefs,
  getHoldings,
  getOrCreateProfile,
  listInstruments,
} from "@/lib/db/queries";
import { computePlan, roomAfterContributions } from "@/lib/engine/plan";
import { toPlanInput } from "@/lib/plan-input";
import { formatCAD } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { getQuotes } from "@/lib/market/yahoo";
import { EditorLinks } from '@/components/editor-links';
import { AccountManagerLink } from "@/components/account-manager-link";
import { AppIcon } from "@/components/ui/app-icon";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [
    profile,
    accountAlloc,
    etfAlloc,
    instruments,
    contributions,
    fxPrefs,
    holdings,
  ] = await Promise.all([
    getOrCreateProfile(db, user.id),
    getAccountAllocations(db, user.id),
    getEtfAllocations(db, user.id),
    listInstruments(db),
    getContributions(db, user.id),
    getFxPrefs(db, user.id),
    getHoldings(db, user.id),
  ]);
  const plan = computePlan(
    toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs),
  );
  const year = new Date().getFullYear();
  const card = (account: "TFSA" | "RRSP", room: number, annual: number) => {
    const remaining = roomAfterContributions(room, annual); const used = room > 0 ? Math.min(100, annual / room * 100) : 0;
    const tone = account === "TFSA" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600";
    return <Card className="!p-5 lg:h-[234px]"><div className="flex items-center gap-3"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`}><AppIcon name={account === "TFSA" ? "leaf" : "bank"} className="h-6 w-6" /></span><div><h2 className="text-sm font-semibold">{account}</h2><p className="mt-0.5 text-[28px] font-bold leading-none tabular-nums">{formatCAD(room)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">available room</p></div></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{width:`${used}%`}} /></div><p className="mt-2 text-sm leading-5">{formatCAD(annual)} planned over 12 months<br/>{formatCAD(remaining)} remaining after 12 months</p><AccountManagerLink account={account} className="mt-3 block w-full rounded-lg border border-blue-200 bg-blue-50 py-2 text-center text-sm font-semibold text-blue-600">Manage {account}</AccountManagerLink></Card>;
  };
  const totalRoom = profile.tfsa_room + profile.rrsp_room;
  const totalPlanned = plan.projectedAnnual.TFSA + plan.projectedAnnual.RRSP;
  let quotes: Record<string, { price: number }> = {};
  try { quotes = await getQuotes([...new Set(holdings.map((holding) => holding.ticker))]); } catch { /* Recorded balances are the fallback. */ }
  const balanceByAccount = holdings.reduce<Record<string, number>>((sum, holding) => {
    const native = quotes[holding.ticker]?.price && holding.units > 0 ? holding.units * quotes[holding.ticker].price : holding.balance_native;
    const value = native * (holding.currency === "USD" ? holding.fx_rate : 1);
    sum[holding.account] = (sum[holding.account] ?? 0) + value;
    return sum;
  }, {});
  const totalBalance = Object.values(balanceByAccount).reduce((sum, value) => sum + value, 0);
  const contributionYtd = (account: string) => contributions.filter((item) => item.account === account && item.contributed_on.startsWith(String(year))).reduce((sum, item) => sum + item.amount_cad, 0);
  return (
    <div className="accounts-main mx-auto w-full max-w-[1276px]">
      <EditorLinks />
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage your contribution room, balances, and recent activity.
          </p>
        </div>
        <AccountManagerLink
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Manage accounts
        </AccountManagerLink>
      </header>
      <nav className="mt-3 flex gap-3 overflow-x-auto whitespace-nowrap border-b border-[var(--border)] text-sm">
        <span className="-mb-px rounded-t-lg border-b-2 border-blue-600 bg-blue-50 px-5 py-2 font-semibold text-blue-600">
          Overview
        </span>
        <AccountManagerLink account="TFSA" className="px-5 py-2 text-blue-600">TFSA</AccountManagerLink>
        <AccountManagerLink account="RRSP" className="px-5 py-2 text-blue-600">RRSP</AccountManagerLink>
        <a href="#account-balances" className="px-5 py-2 text-blue-600">All accounts</a>
      </nav>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {card("TFSA", profile.tfsa_room, plan.projectedAnnual.TFSA)}
        {card("RRSP", profile.rrsp_room, plan.projectedAnnual.RRSP)}
        <Card className="!p-5 lg:h-[234px]">
          <div className="flex items-start gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600"><AppIcon name="briefcase" className="h-6 w-6" /></span><div><h2 className="text-sm font-semibold">Total across all accounts</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Current portfolio value</p><p className="mt-2 text-[28px] font-bold leading-none tabular-nums">{formatCAD(totalBalance)}</p><p className="mt-2 text-sm font-medium text-[var(--text-muted)]">Performance data unavailable</p></div></div>
          <p className="mt-5 text-xs text-[var(--text-muted)]">Combined value of your recorded holdings. Historical balances are not yet available.</p>
        </Card>
      </div>
      <div className="mt-3">
        <Card className="!p-4 lg:h-[285px]">
          <div className="mb-3 flex items-start justify-between gap-4"><div><h2 id="account-balances" className="text-base font-semibold">Account balances</h2><p className="mt-0.5 text-sm text-[var(--text-muted)]">As of {new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}</p></div><AccountManagerLink className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600">Manage accounts</AccountManagerLink></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-left text-xs">
            <colgroup><col className="w-[15%]" /><col className="w-[11%]" /><col className="w-[22%]" /><col className="w-[25%]" /><col className="w-[16%]" /><col className="w-[11%]" /></colgroup>
            <thead className="bg-slate-50 font-medium text-[var(--text-muted)]"><tr>
              <th className="rounded-l-md px-1.5 py-2 font-medium">Account</th><th className="px-1.5 py-2 font-medium">Type</th><th className="px-1.5 py-2 font-medium">Current value (CAD)</th><th className="px-1.5 py-2 font-medium">Contributions (YTD)</th><th className="px-1.5 py-2 font-medium">Gain/Loss</th><th className="rounded-r-md px-1.5 py-2 text-right font-medium">Actions</th>
            </tr></thead>
            <tbody className="text-[var(--text-primary)]">
              <tr><td className="border-b border-[var(--border)] px-1.5 py-2.5 font-semibold">TFSA</td><td className="border-b border-[var(--border)] px-1.5 py-2.5">TFSA</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 font-medium">{formatCAD(balanceByAccount.TFSA ?? 0)}</td><td className="border-b border-[var(--border)] px-1.5 py-2.5">{formatCAD(contributionYtd("TFSA"))}</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 text-[var(--text-muted)]">—</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 text-right"><AccountManagerLink account="TFSA" className="rounded px-1.5 py-1 font-bold hover:bg-blue-50" aria-label="Manage TFSA account">•••</AccountManagerLink></td></tr>
              <tr><td className="border-b border-[var(--border)] px-1.5 py-2.5 font-semibold">RRSP</td><td className="border-b border-[var(--border)] px-1.5 py-2.5">RRSP</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 font-medium">{formatCAD(balanceByAccount.RRSP ?? 0)}</td><td className="border-b border-[var(--border)] px-1.5 py-2.5">{formatCAD(contributionYtd("RRSP"))}</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 text-[var(--text-muted)]">—</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 text-right"><AccountManagerLink account="RRSP" className="rounded px-1.5 py-1 font-bold hover:bg-blue-50" aria-label="Manage RRSP account">•••</AccountManagerLink></td></tr>
              <tr><td className="border-b border-[var(--border)] px-1.5 py-2.5 font-semibold">Cash</td><td className="border-b border-[var(--border)] px-1.5 py-2.5">Cash</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 font-medium">{formatCAD(balanceByAccount.CASH ?? 0)}</td><td className="border-b border-[var(--border)] px-1.5 py-2.5">{formatCAD(contributionYtd("CASH"))}</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 text-[var(--text-muted)]">—</td><td className="border-b border-[var(--border)] px-1.5 py-2.5 text-right"><AccountManagerLink account="CASH" className="rounded px-1.5 py-1 font-bold hover:bg-blue-50" aria-label="Manage cash account">•••</AccountManagerLink></td></tr>
              <tr className="font-bold"><td className="px-1.5 py-2.5">Total</td><td className="px-1.5 py-2.5" /><td className="px-1.5 py-2.5">{formatCAD(totalBalance)}</td><td className="px-1.5 py-2.5">{formatCAD(contributions.filter((item) => item.contributed_on.startsWith(String(year))).reduce((sum,item)=>sum+item.amount_cad,0))}</td><td className="px-1.5 py-2.5 text-[var(--text-muted)]">—</td><td /></tr>
            </tbody>
          </table></div>
        </Card>
        <Card className="hidden !p-4 lg:h-[285px]" title="Contribution room">
          <span className="-ml-2 -mt-[46px] float-right text-sm text-[var(--text-muted)]" aria-label="Contribution room information">ⓘ</span>
          <div className="flex items-baseline justify-between"><p className="font-semibold">TFSA room</p><b>{formatCAD(profile.tfsa_room)}</b></div><p className="mt-1 text-xs text-[var(--text-muted)]">{formatCAD(plan.projectedAnnual.TFSA)} planned · {formatCAD(roomAfterContributions(profile.tfsa_room,plan.projectedAnnual.TFSA))} remaining</p>
          <div className="mt-2 h-2 rounded bg-slate-100">
            <div
              className="h-full rounded bg-emerald-500"
              style={{
                width: `${Math.min(100, (plan.projectedAnnual.TFSA / profile.tfsa_room) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-4 flex items-baseline justify-between"><p className="font-semibold">RRSP room</p><b>{formatCAD(profile.rrsp_room)}</b></div><p className="mt-1 text-xs text-[var(--text-muted)]">{formatCAD(plan.projectedAnnual.RRSP)} planned · {formatCAD(roomAfterContributions(profile.rrsp_room,plan.projectedAnnual.RRSP))} remaining</p>
          <div className="mt-2 h-2 rounded bg-slate-100">
            <div
              className="h-full rounded bg-emerald-500"
              style={{
                width: `${Math.min(100, (plan.projectedAnnual.RRSP / profile.rrsp_room) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">You have <b>{formatCAD(totalRoom)}</b> in total contribution room.<br/><span className="text-xs">{formatCAD(profile.tfsa_room)} TFSA · {formatCAD(profile.rrsp_room)} RRSP</span></div>
        </Card>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]"><Card className="min-h-[258px] !p-4 sm:!p-5" title="Recent contributions"><div className="flex justify-end"><AccountManagerLink className="-mt-8 text-xs font-semibold text-blue-600">View all</AccountManagerLink></div><table className="w-full text-left text-xs"><thead className="text-[var(--text-muted)]"><tr><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Account</th><th className="py-2 font-medium">Amount</th><th className="py-2 font-medium">Type</th><th className="py-2 font-medium">Status</th></tr></thead><tbody>{contributions.slice(-5).reverse().map(c=><tr key={c.id} className="border-t border-[var(--border)]"><td className="py-2">{new Date(`${c.contributed_on}T12:00:00`).toLocaleDateString('en-CA')}</td><td>{c.account}</td><td className="font-semibold">{formatCAD(c.amount_cad)}</td><td>Contribution</td><td className="text-emerald-600">● Completed</td></tr>)}{!contributions.length&&<tr><td colSpan={5} className="py-12 text-center text-sm text-[var(--text-muted)]">No contributions yet.</td></tr>}</tbody></table></Card><Card className="min-h-[258px] !p-4 sm:!p-5" title="Account types"><div className="space-y-2">{([['leaf','Tax-Free Savings Account (TFSA)','Grow your investments tax-free.','bg-emerald-50 text-emerald-600'],['bank','Registered Retirement Savings Plan (RRSP)','Save for retirement with tax advantages.','bg-blue-50 text-blue-600'],['cash','Cash account','Keep cash for short-term needs.','bg-orange-50 text-orange-500']] as const).map(([icon,title,copy,tone])=><div key={title} className="flex min-h-[58px] items-center gap-3 rounded-lg border border-[var(--border)] px-2 py-1.5"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}><AppIcon name={icon} className="h-5 w-5" /></span><span className="min-w-0 flex-1"><b className="block text-xs">{title}</b><small className="block text-[11px] leading-4 text-[var(--text-muted)]">{copy}</small></span></div>)}</div></Card></div>
    </div>
  );
}
