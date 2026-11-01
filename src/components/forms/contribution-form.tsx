'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';
import { deleteContribution, recordPurchase, resolveCycle, undoCycle, updateContribution, type ContributionLine, type ContributionRow, type InstrumentRow, type ScheduleRow } from '@/lib/db/queries';
import { coversNextByDefault, dueAfter, todayInToronto } from '@/lib/engine/schedule';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { formatCAD } from '@/lib/format';

type ContributionAccount = 'TFSA' | 'RRSP' | 'CASH';

/** Latest prices for working out units when the user doesn't enter them. */
async function latestPrice(ticker: string, currency: string): Promise<{ price: number | null; rate: number | null }> {
  const tickers = currency === 'USD' ? `${ticker},CAD=X` : ticker;
  const response = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(tickers)}`).catch(() => null);
  const quotes = response?.ok ? (await response.json()).quotes : null;
  return { price: quotes?.[ticker]?.price ?? null, rate: currency === 'USD' ? quotes?.['CAD=X']?.price ?? null : 1 };
}

export function ContributionForm({ userId, contributions, initialAccount = 'TFSA', instruments = [], schedule = null, rooms }: { rooms?: { TFSA: number; RRSP: number }; userId: string; contributions: ContributionRow[]; initialAccount?: ContributionAccount; instruments?: InstrumentRow[]; schedule?: ScheduleRow | null }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInToronto());
  const [account, setAccount] = useState<ContributionAccount>(initialAccount);
  const [instrumentId, setInstrumentId] = useState('none');
  const [units, setUnits] = useState('');
  const [choice, setChoice] = useState<'covers' | 'extra' | null>(null);
  const [editing, setEditing] = useState<ContributionRow | null>(null);
  useEffect(() => {
    const select = (event: Event) => { const value = (event as CustomEvent).detail; if (['TFSA', 'RRSP', 'CASH'].includes(value)) setAccount(value); };
    window.addEventListener('select-contribution-account', select);
    return () => window.removeEventListener('select-contribution-account', select);
  }, []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activeSchedule = schedule && !schedule.paused ? schedule : null;
  // The safe default depends on the date, until the user picks an answer.
  const covers = choice ? choice === 'covers' : Boolean(activeSchedule && coversNextByDefault(date, activeSchedule.next_due));
  const instrument = account === 'CASH' ? undefined : instruments.find((item) => String(item.id) === instrumentId);
  const rows = useMemo(() => contributions.slice().reverse(), [contributions]);
  const tickerOf = (row: ContributionRow) => instruments.find((item) => item.id === row.instrument_id)?.ticker ?? '—';

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    const enteredUnits = units.trim() === '' ? null : Number(units);
    if (!Number.isFinite(value) || value <= 0 || !date) {
      setMessage('Enter a positive amount and contribution date.');
      return;
    }
    if (Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
      setMessage('Enter a CAD amount with no more than two decimal places.');
      return;
    }
    if (enteredUnits !== null && (!Number.isFinite(enteredUnits) || enteredUnits <= 0)) {
      setMessage('Units must be a positive number.');
      return;
    }
    // Editing gives back the old amount first, so it counts as room here.
    const room = account === 'CASH' || !rooms ? null : rooms[account] + (editing?.account === account ? editing.amount_cad : 0);
    const allowOver = room !== null && value > room;
    if (allowOver && !window.confirm(`This is ${formatCAD(value - Math.max(room, 0))} over your ${account} room, and the CRA can charge penalties on excess contributions. Record it anyway?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const db = clientSupabase();
      const line: ContributionLine = { account, instrument_id: instrument?.id ?? null, amount_cad: value, contributed_on: date, allow_over: allowOver };
      if (instrument) {
        const { price, rate } = await latestPrice(instrument.ticker, instrument.currency);
        const native = rate ? value / rate : null;
        line.units = enteredUnits ?? (price && native ? Math.round((native / price) * 10000) / 10000 : null);
        line.amount_native = native === null ? null : Math.round(native * 100) / 100;
        line.fx_rate = rate;
        line.price_native = line.units && native ? native / line.units : null;
      }
      if (editing) {
        await updateContribution(db, editing.id, line);
        setEditing(null);
        setMessage('Contribution updated.');
      } else if (activeSchedule && covers) {
        const result = await resolveCycle(db, { due: activeSchedule.next_due, status: 'manual', lines: [line], nextDue: dueAfter(activeSchedule.next_due, activeSchedule.day_of_month) });
        // The instalment was handled elsewhere (another tab, or it came due), so this is a separate deposit.
        if (!result.applied) throw new Error('That instalment was already handled. Refresh the page, then log this as extra if it still applies.');
        setMessage(`Contribution logged. The ${activeSchedule.next_due} instalment won't record again.`);
      } else {
        await recordPurchase(db, userId, line);
        setMessage('Contribution logged.');
      }
      setAmount('');
      setUnits('');
      setChoice(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not log contribution');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: ContributionRow) {
    setEditing(row);
    setAmount(String(row.amount_cad));
    setDate(row.contributed_on);
    setAccount(row.account as ContributionAccount);
    setInstrumentId(row.instrument_id ? String(row.instrument_id) : 'none');
    setUnits(row.units == null ? '' : String(row.units));
    setMessage(null);
    document.getElementById('contributionAmount')?.focus();
  }

  function cancelEdit() {
    setEditing(null);
    setAmount('');
    setUnits('');
    setDate(todayInToronto());
    setMessage(null);
  }

  async function remove(row: ContributionRow) {
    if (!window.confirm(`Delete this ${formatCAD(row.amount_cad)} contribution? Its room and holding units are restored.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      // A manual entry stood in for its whole instalment, so removing it undoes the instalment too.
      if (row.source === 'manual' && row.cycle_due_on) await undoCycle(clientSupabase(), row.cycle_due_on);
      else await deleteContribution(clientSupabase(), row.id);
      setMessage('Contribution deleted.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete contribution');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={add} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end" noValidate>
        <Field label="Amount (CAD)" htmlFor="contributionAmount"><Input id="contributionAmount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Contribution date" htmlFor="contributionDate"><DatePicker id="contributionDate" value={date} onChange={setDate} aria-label="Contribution date" /></Field>
        <Field label="Account" htmlFor="contributionAccount"><Select id="contributionAccount" value={account} onChange={(e) => setAccount(e.target.value as ContributionAccount)}><option value="TFSA">TFSA</option><option value="RRSP">RRSP</option><option value="CASH">Cash</option></Select></Field>
        {account !== 'CASH' && <Field label="Investment" htmlFor="contributionInstrument"><Select id="contributionInstrument" value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)}><option value="none">Deposit only, no purchase</option>{instruments.map((item) => <option key={item.id} value={item.id}>{item.ticker} · {item.name}</option>)}</Select></Field>}
        {instrument && <Field label="Units bought (optional)" htmlFor="contributionUnits" hint="Leave blank to estimate from the latest price."><Input id="contributionUnits" type="number" min={0} step="0.0001" value={units} onChange={(e) => setUnits(e.target.value)} /></Field>}
        {activeSchedule && !editing && <fieldset className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm sm:col-span-3"><legend className="px-1 text-xs font-semibold">Your next instalment is due {activeSchedule.next_due}</legend>
          <label className="flex items-center gap-2 py-1"><input type="radio" name="contributionCycle" checked={covers} onChange={() => setChoice('covers')} />This replaces it, so it won&apos;t record again, whatever the amount</label>
          <label className="flex items-center gap-2 py-1"><input type="radio" name="contributionCycle" checked={!covers} onChange={() => setChoice('extra')} />This is extra, so it still records on its due date</label></fieldset>}
        <div className="flex gap-2"><Button type="submit" loading={busy} loadingLabel="Saving…">{editing ? 'Save changes' : 'Log contribution'}</Button>{editing && <Button variant="secondary" disabled={busy} onClick={cancelEdit}>Cancel</Button>}</div>
      </form>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">This records a deposit you have already made and reduces TFSA or RRSP room. Choosing an investment also updates that holding.</p>
      {message && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400" role="status">{message}</p>}
      <div className="mt-4 overflow-x-auto">
        {rows.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No contributions logged yet.</p> : (
          <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="pb-2">Date</th><th className="pb-2">Account</th><th className="pb-2">Investment</th><th className="pb-2 text-right">Amount</th><th className="pb-2 text-right">Action</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-2">{row.contributed_on}{row.source === 'auto' && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">Auto</span>}</td><td className="py-2">{row.account === 'CASH' ? 'Cash' : row.account}</td><td className="py-2">{tickerOf(row)}{row.instrument_id && row.units == null && <span className="ml-2 text-xs text-amber-700">Units need review</span>}</td><td className="py-2 text-right">{formatCAD(row.amount_cad)}</td><td className="py-2 text-right"><span className="inline-flex gap-3 text-xs font-semibold"><button type="button" disabled={busy} onClick={() => startEdit(row)} className="text-[var(--color-primary)]">Edit</button><button type="button" disabled={busy} onClick={() => remove(row)} className="text-red-600">Delete</button></span></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
