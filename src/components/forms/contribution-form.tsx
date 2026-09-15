'use client';

import { useState } from 'react';
import { clientSupabase } from '@/lib/supabase/client';
import { addContribution, type ContributionRow } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { formatCAD } from '@/lib/format';

type ContributionAccount = 'TFSA' | 'RRSP' | 'CASH';

export function ContributionForm({ userId, contributions }: { userId: string; contributions: ContributionRow[] }) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState<ContributionAccount>('TFSA');
  const [rows, setRows] = useState(contributions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !date) {
      setMessage('Enter a positive amount and contribution date.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await addContribution(clientSupabase(), userId, {
        account,
        instrument_id: null,
        amount_cad: value,
        fx_provider: null,
        fx_rate: null,
        fx_cost_cad: null,
        amount_native: null,
        contributed_on: date,
      });
      setRows((current) => [...current, {
        id: -Date.now(), account, instrument_id: null, amount_cad: value,
        fx_provider: null, fx_rate: null, fx_cost_cad: null, amount_native: null, contributed_on: date,
      }].sort((a, b) => a.contributed_on.localeCompare(b.contributed_on)));
      setAmount('');
      setMessage('Contribution logged.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not log contribution');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={add} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Amount (CAD)" htmlFor="contributionAmount"><Input id="contributionAmount" type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Contribution date" htmlFor="contributionDate"><Input id="contributionDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Account" htmlFor="contributionAccount"><Select id="contributionAccount" value={account} onChange={(e) => setAccount(e.target.value as ContributionAccount)}><option value="TFSA">TFSA</option><option value="RRSP">RRSP</option><option value="CASH">Cash</option></Select></Field>
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Log contribution'}</Button>
      </form>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">This records an actual deposit for dashboard history. It does not update CRA room or add a holding automatically.</p>
      {message && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400" role="status">{message}</p>}
      <div className="mt-4 overflow-x-auto">
        {rows.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No contributions logged yet.</p> : (
          <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="pb-2">Date</th><th className="pb-2">Account</th><th className="pb-2 text-right">Amount</th></tr></thead>
            <tbody>{rows.slice(-12).reverse().map((row) => <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-2">{row.contributed_on}</td><td className="py-2">{row.account === 'CASH' ? 'Cash' : row.account}</td><td className="py-2 text-right">{formatCAD(row.amount_cad)}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
