'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';
import { addRoom, type RoomEventRow } from '@/lib/db/queries';
import { formatCAD } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const KIND = { new_limit: 'New yearly limit', restored: 'Withdrawal restored', adjustment: 'Correction' } as const;

export function RoomHistory({ events, year, askForLimit }: { events: RoomEventRow[]; year: number; askForLimit: boolean }) {
  const router = useRouter();
  const [account, setAccount] = useState<'TFSA' | 'RRSP'>('TFSA');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) { setMessage('Enter a positive amount.'); return; }
    setBusy(true); setMessage(null);
    try {
      await addRoom(clientSupabase(), account, value, 'new_limit', `${year} limit`);
      setAmount(''); setMessage(`Added to your ${account} room.`); router.refresh();
    } catch { setMessage('Could not add this room.'); }
    finally { setBusy(false); }
  }

  return <div>
    {askForLimit && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Your {year} TFSA limit isn&apos;t recorded yet. Check it with the CRA, then add it below. It isn&apos;t added automatically, because the yearly amount changes.</p>}
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
      <Field label="Account" htmlFor="roomAccount"><Select id="roomAccount" value={account} onChange={(e) => setAccount(e.target.value as 'TFSA' | 'RRSP')}><option value="TFSA">TFSA</option><option value="RRSP">RRSP</option></Select></Field>
      <Field label="New room (CAD)" htmlFor="roomAmount" hint="TFSA: the yearly limit. RRSP: the new room on your Notice of Assessment."><Input id="roomAmount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Button type="submit" loading={busy} loadingLabel="Adding…">Add room</Button>
    </form>
    {message && <p role="status" className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>}
    {events.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-[var(--text-muted)]"><tr><th className="pb-2">Date</th><th className="pb-2">Account</th><th className="pb-2">Change</th><th className="pb-2 text-right">Amount</th></tr></thead><tbody>{events.map((row) => <tr key={row.id} className="border-t border-[var(--border)]"><td className="py-2">{row.effective_on}</td><td className="py-2">{row.account}</td><td className="py-2">{KIND[row.kind]}{row.note && <span className="ml-2 text-xs text-[var(--text-muted)]">{row.note}</span>}</td><td className="py-2 text-right tabular-nums">{row.amount_cad >= 0 ? '+' : ''}{formatCAD(row.amount_cad)}</td></tr>)}</tbody></table></div>}
  </div>;
}
