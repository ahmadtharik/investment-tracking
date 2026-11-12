'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';
import { deleteSchedule, markCyclesReviewed, resolveCycle, saveSchedule, undoCycle, type CycleRow, type ScheduleRow } from '@/lib/db/queries';
import { dueAfter, nextDueForNewDay, nextDueFrom, todayInToronto, type InstalmentLine } from '@/lib/engine/schedule';
import { formatCAD } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

const STATUS: Record<CycleRow['status'], string> = { auto: 'Recorded automatically', early: 'Recorded early', manual: 'Recorded manually', skipped: 'Skipped' };
const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });

export function ContributionSchedule({ userId, schedule, cycles, instalment }: { userId: string; schedule: ScheduleRow | null; cycles: CycleRow[]; instalment: InstalmentLine[] }) {
  const router = useRouter();
  const [day, setDay] = useState(String(schedule?.day_of_month ?? 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = instalment.reduce((sum, line) => sum + line.amountCad, 0);

  async function run(work: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await work(); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update your schedule.'); }
    finally { setBusy(false); }
  }
  const dayNumber = Number(day);
  // A new day or a resume starts from the next open date, so nothing is back-filled or repeated.
  const start = (paused: boolean) => run(() => saveSchedule(clientSupabase(), userId, { day_of_month: dayNumber, paused, next_due: schedule && !schedule.paused ? nextDueForNewDay(todayInToronto(), dayNumber, schedule.next_due, cycles[0]?.due_on) : nextDueFrom(todayInToronto(), dayNumber, cycles[0]?.due_on) }));
  const skip = () => run(() => resolveCycle(clientSupabase(), { due: schedule!.next_due, status: 'skipped', lines: [], nextDue: dueAfter(schedule!.next_due, schedule!.day_of_month) }));
  const early = () => run(async () => {
    const response = await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'early' }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error ?? 'Could not record this instalment.');
  });
  const stop = () => { if (window.confirm('Remove this schedule? Past contributions stay as they are.')) void run(() => deleteSchedule(clientSupabase(), userId)); };
  const undo = (due: string) => { if (window.confirm('Remove this instalment? Its room and holding units are restored.')) void run(() => undoCycle(clientSupabase(), due)); };
  const dayPicker = <label className="text-xs text-[var(--text-muted)]">Day of each month<Select aria-label="Day of each month" className="mt-1" value={day} disabled={busy} onChange={(e) => setDay(e.target.value)}>{Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}{i + 1 > 28 ? ' (or last day)' : ''}</option>)}</Select></label>;

  return <section id="contribution-schedule" className="mt-3 scroll-mt-24 rounded-[14px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[16px] font-bold">Contribution schedule</h2><p className="text-xs text-[var(--text-muted)]">Tracks your plan each month, even if you don&apos;t sign in. This only keeps your records: it doesn&apos;t move money or place trades, so set up the matching purchase with your brokerage.</p></div>{schedule && <div className="flex items-end gap-2">{dayPicker}{Number(day) !== schedule.day_of_month && <Button variant="secondary" disabled={busy} onClick={() => start(schedule.paused)}>Save day</Button>}</div>}</div>
    {!schedule && <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">{dayPicker}<Button loading={busy} loadingLabel="Starting…" disabled={total <= 0} onClick={() => start(false)}>Start schedule</Button><p className="text-xs text-[var(--text-muted)]">{total > 0 ? `${formatCAD(total)} a month, starting from your next date. Earlier months aren't back-filled.` : 'Set your income, expenses and allocation first.'}</p></div>}
    {schedule && <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-[var(--text-muted)]">{schedule.paused ? 'Paused' : 'Next instalment'}</p><p className="text-base font-bold">{schedule.paused ? 'Nothing will record while paused' : `${formatDate(schedule.next_due)} · ${formatCAD(total)}`}</p></div>
        <div className="flex flex-wrap gap-2">{schedule.paused ? <><Button loading={busy} loadingLabel="Resuming…" onClick={() => start(false)}>Resume</Button><Button variant="danger" disabled={busy} onClick={stop}>Remove schedule</Button></> : <><Button disabled={busy || total <= 0} onClick={early}>Record now</Button><Link href={`/accounts/manage#record-contribution`} className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-card)] px-3.5 py-2 text-sm font-medium">Enter my own amount</Link><Button variant="secondary" disabled={busy} onClick={skip}>Skip this one</Button><Button variant="secondary" disabled={busy} onClick={() => run(() => saveSchedule(clientSupabase(), userId, { ...schedule, paused: true }))}>Pause</Button></>}</div></div>
      {!schedule.paused && <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{instalment.map((line, index) => <li key={index} className="flex justify-between gap-3 rounded-lg bg-white px-3 py-2"><span>{line.account === 'CASH' ? 'Cash' : line.account} · {line.ticker ?? (line.account === 'CASH' ? 'Deposit' : 'No investment selected')}</span><b className="tabular-nums">{formatCAD(line.amountCad)}</b></li>)}</ul>}
      {!schedule.paused && <p className="mt-2 text-xs text-[var(--text-muted)]">If you do nothing, this records on its due date. Amounts follow your plan and stop at your available room.</p>}
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    {cycles.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="text-[var(--text-muted)]"><tr><th className="py-2 font-semibold">Due</th><th className="py-2 font-semibold">Result</th><th className="py-2 text-right font-semibold">Action</th></tr></thead><tbody>{cycles.map((cycle) => <tr key={cycle.id} className="border-t border-[var(--border)]"><td className="py-2">{formatDate(cycle.due_on)}</td><td className="py-2">{STATUS[cycle.status]}{cycle.note && <span className="ml-2 text-amber-700">{cycle.note}</span>}</td><td className="py-2 text-right">{(cycle.status !== 'skipped' || cycle.due_on > todayInToronto()) && <button type="button" disabled={busy} onClick={() => undo(cycle.due_on)} className="font-semibold text-[var(--color-primary)]">Undo</button>}</td></tr>)}</tbody></table></div>}
  </section>;
}

/** Tells a returning user what was recorded while they were away. */
export function RecordedNotice({ userId, count }: { userId: string; count: number }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  if (count === 0 || hidden) return null;
  const dismiss = () => { setHidden(true); void markCyclesReviewed(clientSupabase(), userId).then(() => router.refresh()).catch(() => undefined); };
  return <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm"><span>{count === 1 ? '1 instalment was' : `${count} instalments were`} recorded automatically since your last visit. Check they match your brokerage.</span><span className="flex gap-3 font-semibold"><Link href="/plan#contribution-schedule" className="text-[var(--color-primary)]">Review</Link><button type="button" onClick={dismiss} className="text-[var(--text-muted)]">Dismiss</button></span></div>;
}
