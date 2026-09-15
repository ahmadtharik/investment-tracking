import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getContributions, getEtfAllocations, getFxPrefs, getOrCreateProfile, getWithdrawals, listInstruments } from '@/lib/db/queries';
import { computePlan, roomAfterContributions } from '@/lib/engine/plan';
import { toPlanInput } from '@/lib/plan-input';
import { formatCAD } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { RoomForm } from '@/components/forms/room-form';
import { WithdrawalForm } from '@/components/forms/withdrawal-form';
import { ContributionForm } from '@/components/forms/contribution-form';
import { RoomDepletionChart } from '@/components/room-depletion-chart';
import { ExtraCashScenario } from '@/components/extra-cash-scenario';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments, withdrawals, contributions, fxPrefs] = await Promise.all([
    getOrCreateProfile(db, user.id), getAccountAllocations(db, user.id), getEtfAllocations(db, user.id), listInstruments(db), getWithdrawals(db, user.id), getContributions(db, user.id), getFxPrefs(db, user.id),
  ]);
  const plan = computePlan(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
  const year = new Date().getFullYear();
  const tfsaWithdrawals = withdrawals.filter((w) => w.account === 'TFSA');
  const restorations = tfsaWithdrawals.filter((w) => w.room_restored_in != null && w.room_restored_in >= year).map((w) => ({ atMonth: (w.room_restored_in as number) - year, amount: w.amount_cad })).filter((r) => r.atMonth >= 0 && r.atMonth <= 60);
  const tfsaMonthly = plan.accounts.find((a) => a.key === 'TFSA')?.effective ?? 0;
  const rrspMonthly = plan.accounts.find((a) => a.key === 'RRSP')?.effective ?? 0;
  const card = (account: 'TFSA' | 'RRSP', room: number, annual: number) => <Card title={account} description={account === 'TFSA' ? 'Tax-free savings account contribution room.' : 'Registered retirement savings plan contribution room.'}><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-wide text-zinc-500">Available room</p><p className="mt-1 text-xl font-semibold">{formatCAD(room)}</p></div><div><p className="text-xs uppercase tracking-wide text-zinc-500">Planned annual</p><p className="mt-1 text-xl font-semibold">{formatCAD(annual)}</p></div><div><p className="text-xs uppercase tracking-wide text-zinc-500">Est. year-end room</p><p className="mt-1 text-xl font-semibold">{formatCAD(roomAfterContributions(room, annual))}</p></div></div><p className="mt-3 text-sm text-zinc-500">Current plan allocation: {formatCAD(account === 'TFSA' ? tfsaMonthly : rrspMonthly)} per month.</p>{room < annual && <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Planned contributions ({formatCAD(annual)}) exceed available room ({formatCAD(room)}). The dashboard caps this month&apos;s purchase.</div>}</Card>;
  return <div><h1 className="text-2xl font-semibold tracking-tight">Accounts</h1><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Track contribution room, actual deposits, projected usage, and TFSA withdrawals.</p><div className="mt-5"><Card title="Contribution room" description="Update the available room shown in your CRA account. Values are in CAD."><RoomForm userId={user.id} profile={profile} /></Card></div><div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">{card('TFSA', profile.tfsa_room, plan.projectedAnnual.TFSA)}{card('RRSP', profile.rrsp_room, plan.projectedAnnual.RRSP)}</div><div className="mt-5"><Card title="Log an actual contribution" description="Record a deposit so it appears in dashboard contribution history."><ContributionForm userId={user.id} contributions={contributions} /></Card></div><div className="mt-5"><Card title="TFSA withdrawals" description="Withdrawals restore room in the following year by default."><WithdrawalForm userId={user.id} withdrawals={tfsaWithdrawals} /></Card></div><div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2"><Card title="TFSA room forecast" description="Includes the current plan and a planning assumption for annual TFSA additions."><RoomDepletionChart account="TFSA" room={profile.tfsa_room} monthlyContribution={tfsaMonthly} annualPlanned={plan.projectedAnnual.TFSA} annualRoomAddition={7000} restorations={restorations} currentYear={year} /></Card><Card title="RRSP room forecast" description="Uses only the room entered from your CRA records and does not assume future additions."><RoomDepletionChart account="RRSP" room={profile.rrsp_room} monthlyContribution={rrspMonthly} annualPlanned={plan.projectedAnnual.RRSP} currentYear={year} /></Card></div><ExtraCashScenario tfsaRoom={profile.tfsa_room} rrspRoom={profile.rrsp_room} tfsaMonthly={tfsaMonthly} rrspMonthly={rrspMonthly} /></div>;
}


