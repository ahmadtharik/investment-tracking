'use client';
import { useMemo, useState } from 'react';
import { roomTrajectory } from '@/lib/engine/plan';
import { formatCAD } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
export function ExtraCashScenario({ tfsaRoom, rrspRoom, tfsaMonthly, rrspMonthly }: { tfsaRoom: number; rrspRoom: number; tfsaMonthly: number; rrspMonthly: number }) {
  const [amount, setAmount] = useState(''); const [account, setAccount] = useState<'TFSA' | 'RRSP'>('TFSA');
  const lump = Math.max(0, Number(amount) || 0); const room = Math.max(0, account === 'TFSA' ? tfsaRoom : rrspRoom); const monthly = Math.max(0, account === 'TFSA' ? tfsaMonthly : rrspMonthly); const remaining = Math.max(0, room - lump);
  const depletion = useMemo(() => roomTrajectory(remaining, monthly, 60).find((p) => p.month > 0 && p.remaining <= 0)?.month, [remaining, monthly]); const currentDepletion = useMemo(() => roomTrajectory(room, monthly, 60).find((p) => p.month > 0 && p.remaining <= 0)?.month, [room, monthly]);
  return <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700"><h2 className="text-base font-semibold">One-time extra cash scenario</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Comparison only. This hypothetical lump-sum contribution does not change your saved plan.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm"><span className="mb-1 block font-medium">Extra cash (CAD)</span><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label><label className="text-sm"><span className="mb-1 block font-medium">Account</span><Select value={account} onChange={(e) => setAccount(e.target.value as 'TFSA' | 'RRSP')}><option value="TFSA">TFSA</option><option value="RRSP">RRSP</option></Select></label></div><div className="mt-4 space-y-1 text-sm">{lump <= 0 ? <p>Enter a nonnegative amount to see the comparison.</p> : room <= 0 ? <p>No available {account} room is recorded.</p> : <><p>Remaining {account} room immediately after contribution: <span className="font-semibold">{formatCAD(remaining)}</span>.</p><p>Current plan exhausts room {currentDepletion ? `in about ${currentDepletion} months` : 'beyond 60 months'}; after this lump sum: {depletion ? `about ${depletion} months` : 'not within 60 months'}.</p></>}</div></div>;
}

