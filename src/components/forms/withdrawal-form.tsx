'use client';

import { useState } from 'react';
import { clientSupabase } from '@/lib/supabase/client';
import { addWithdrawal, deleteWithdrawal, type WithdrawalRow } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Field } from '@/components/ui/field';
import { formatCAD } from '@/lib/format';
import { InfoTooltip } from '@/components/ui/info-tooltip';

export function WithdrawalForm({ userId, withdrawals }: { userId: string; withdrawals: WithdrawalRow[] }) {
  const currentYear = new Date().getFullYear();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [restoreYear, setRestoreYear] = useState(String(currentYear + 1));
  const [rows, setRows] = useState(withdrawals);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    const year = Number(restoreYear);
    if (!Number.isFinite(value) || value <= 0 || !date || !Number.isInteger(year) || year < 1900) {
      setMessage('Enter a positive amount, date, and valid restoration year.');
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const saved = await addWithdrawal(clientSupabase(), userId, { account: 'TFSA', amount_cad: value, withdrawn_on: date, room_restored_in: year });
      setRows((r) => [...r, saved].sort((a, b) => a.withdrawn_on.localeCompare(b.withdrawn_on)));
      setAmount(''); setMessage('Withdrawal added ✓');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add withdrawal'); }
    finally { setBusy(false); }
  }

  async function remove(row: WithdrawalRow) {
    if (!window.confirm('Remove this withdrawal record?')) return;
    setBusy(true); setMessage(null);
    try { await deleteWithdrawal(clientSupabase(), userId, row.id); setRows((r) => r.filter((x) => x.id !== row.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not remove withdrawal'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <form onSubmit={add} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end sm:justify-items-stretch" noValidate>
        <Field label="Amount (CAD)" htmlFor="withdrawalAmount"><Input id="withdrawalAmount" type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Withdrawal date" htmlFor="withdrawalDate"><DatePicker id="withdrawalDate" value={date} onChange={(next) => { setDate(next); if (next) setRestoreYear(String(Number(next.slice(0, 4)) + 1)); }} aria-label="Withdrawal date" /></Field>
        <Field label={<span>Room restored in <InfoTooltip>Usually withdrawal year + 1.</InfoTooltip></span>} htmlFor="restoreYear"><Input id="restoreYear" type="number" min={1900} step={1} value={restoreYear} onChange={(e) => setRestoreYear(e.target.value)} /></Field>
        <Button type="submit" loading={busy} loadingLabel="Adding…">Add withdrawal</Button>
      </form>
      {message && <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>}
      <div className="mt-5 overflow-x-auto">
        {rows.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No withdrawals recorded.</p> : (
          <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="pb-2">Date</th><th className="pb-2 text-center">Amount</th><th className="pb-2 text-center">Room restored</th><th className="pb-2 text-center">Action</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-2">{row.withdrawn_on}</td><td className="py-2 text-center">{formatCAD(row.amount_cad)}</td><td className="py-2 text-center">{row.room_restored_in ?? 'Not set'}</td><td className="py-2 text-center"><Button variant="danger" onClick={() => remove(row)} disabled={busy || row.id < 0}>Remove</Button></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
