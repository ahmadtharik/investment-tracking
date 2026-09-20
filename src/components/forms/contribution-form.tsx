'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';
import { addContribution, type ContributionRow } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/field';
import { formatCAD } from '@/lib/format';

type ContributionAccount = 'TFSA' | 'RRSP' | 'CASH';

export function ContributionForm({ userId, contributions, initialAccount = 'TFSA' }: { userId: string; contributions: ContributionRow[]; initialAccount?: ContributionAccount }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [account, setAccount] = useState<ContributionAccount>(initialAccount);
  useEffect(() => {
    const select = (event: Event) => { const value = (event as CustomEvent).detail; if (['TFSA', 'RRSP', 'CASH'].includes(value)) setAccount(value); };
    window.addEventListener('select-contribution-account', select);
    return () => window.removeEventListener('select-contribution-account', select);
  }, []);
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
    if (Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
      setMessage('Enter a CAD amount with no more than two decimal places.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await addContribution(clientSupabase(), userId, {
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
      setMessage(result.remainingRoom === undefined ? 'Contribution logged.' : `Contribution logged. ${account} room remaining: ${formatCAD(result.remainingRoom)}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not log contribution');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={add} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Amount (CAD)" htmlFor="contributionAmount"><Input id="contributionAmount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Contribution date" htmlFor="contributionDate"><DatePicker id="contributionDate" value={date} onChange={setDate} aria-label="Contribution date" /></Field>
        <Field label="Account" htmlFor="contributionAccount"><Select id="contributionAccount" value={account} onChange={(e) => setAccount(e.target.value as ContributionAccount)}><option value="TFSA">TFSA</option><option value="RRSP">RRSP</option><option value="CASH">Cash</option></Select></Field>
        <Button type="submit" loading={busy} loadingLabel="Saving…">Log contribution</Button>
      </form>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">This records an actual deposit for dashboard history and reduces TFSA or RRSP room immediately. It does not add a holding automatically.</p>
      {message && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400" role="status">{message}</p>}
      <div className="mt-4 overflow-x-auto">
        {rows.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No contributions logged yet.</p> : (
          <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="pb-2">Date</th><th className="pb-2">Account</th><th className="pb-2 text-right">Amount</th></tr></thead>
            <tbody>{rows.slice().reverse().map((row) => <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-2">{row.contributed_on}</td><td className="py-2">{row.account === 'CASH' ? 'Cash' : row.account}</td><td className="py-2 text-right">{formatCAD(row.amount_cad)}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
