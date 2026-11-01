import Link from 'next/link';
import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getContributions, getRoomEvents, getWithdrawals, listInstruments } from '@/lib/db/queries';
import { settleDueCycles } from '@/lib/schedule/settle';
import { formatCAD } from '@/lib/format';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const SOURCE: Record<string, string> = { auto: 'Scheduled', early: 'Scheduled, early', manual: 'Contribution' };
const ROOM: Record<string, string> = { new_limit: 'Room added', restored: 'Room restored', adjustment: 'Room corrected' };

export default async function ActivityPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  await settleDueCycles(db, user.id);
  const [contributions, withdrawals, roomEvents, instruments] = await Promise.all([getContributions(db, user.id), getWithdrawals(db, user.id), getRoomEvents(db, user.id), listInstruments(db)]);
  const ticker = (id: number | null) => instruments.find((item) => item.id === id)?.ticker ?? '';
  const rows = [
    ...contributions.map((c) => ({ key: `c${c.id}`, date: c.contributed_on, account: c.account, type: SOURCE[c.source ?? 'manual'], detail: ticker(c.instrument_id), amount: c.amount_cad })),
    ...withdrawals.map((w) => ({ key: `w${w.id}`, date: w.withdrawn_on, account: w.account, type: 'Withdrawal', detail: '', amount: -w.amount_cad })),
    ...roomEvents.map((e) => ({ key: `r${e.id}`, date: e.effective_on, account: e.account, type: ROOM[e.kind], detail: 'Room only, no money moved', amount: e.amount_cad })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return <div className="mx-auto w-full max-w-[1276px] pb-8">
    <Link href="/accounts" className="text-xs font-semibold text-[var(--color-primary)]">← Accounts overview</Link>
    <h1 className="mt-3 text-[28px] font-bold tracking-tight">Activity</h1>
    <p className="mt-1 text-sm text-[var(--text-muted)]">Everything recorded across your accounts, newest first.</p>
    <Card className="mt-4 !p-4 sm:!p-5">
      {rows.length === 0 ? <p className="py-10 text-center text-sm text-[var(--text-muted)]">No activity yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-xs text-[var(--text-muted)]"><tr><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Account</th><th className="py-2 font-medium">Type</th><th className="py-2 font-medium">Details</th><th className="py-2 text-right font-medium">Amount</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-t border-[var(--border)]"><td className="py-2">{row.date}</td><td className="py-2">{row.account === 'CASH' ? 'Cash' : row.account}</td><td className="py-2">{row.type}</td><td className="py-2 text-[var(--text-muted)]">{row.detail}</td><td className="py-2 text-right font-semibold tabular-nums">{row.amount >= 0 ? '+' : ''}{formatCAD(row.amount)}</td></tr>)}</tbody></table></div>}
    </Card>
  </div>;
}
