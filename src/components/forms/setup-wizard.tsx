'use client';

import { useState } from 'react';
import { clientSupabase } from '@/lib/supabase/client';
import { saveAccountAllocations, saveEtfAllocations, saveProfile, type InstrumentRow, type Profile } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

type Row = { instrumentId: string; pct: string };
const numberValue = (value: string) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };

export function SetupWizard({ userId, profile, instruments, onComplete }: { userId: string; profile: Profile; instruments: InstrumentRow[]; onComplete?: () => void }) {
  const first = instruments[0] ? String(instruments[0].id) : '';
  const [step, setStep] = useState(1);
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState('');
  const [emergency, setEmergency] = useState('');
  const [target, setTarget] = useState('');
  const [tfsaPct, setTfsaPct] = useState('60');
  const [rrspPct, setRrspPct] = useState('20');
  const [cashPct, setCashPct] = useState('20');
  const [tfsaRoom, setTfsaRoom] = useState(String(profile.tfsa_room || 109000));
  const [rrspRoom, setRrspRoom] = useState('');
  const [tfsaEtf, setTfsaEtf] = useState<Row[]>([{ instrumentId: first, pct: '100' }]);
  const [rrspEtf, setRrspEtf] = useState<Row[]>([{ instrumentId: first, pct: '100' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const allocationTotal = numberValue(tfsaPct) + numberValue(rrspPct) + numberValue(cashPct);
  const etfTotal = (rows: Row[]) => rows.reduce((sum, row) => sum + numberValue(row.pct), 0);
  const updateRow = (rows: Row[], setRows: (next: Row[]) => void, index: number, patch: Partial<Row>) => setRows(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const options = instruments.map((instrument) => <option key={instrument.id} value={String(instrument.id)}>{instrument.ticker} / {instrument.name}</option>);

  function next() {
    setError(null);
    if ([income, expenses, emergency, target].some((value) => numberValue(value) < 0) || allocationTotal !== 100) { setError('Enter non-negative amounts and make account allocations total 100%.'); return; }
    setStep(2);
  }
  async function finish(skipOptional = false) {
    setError(null);
    const tfsa = numberValue(tfsaRoom), rrsp = numberValue(rrspRoom);
    if (!skipOptional && (tfsa < 0 || rrsp < 0 || etfTotal(tfsaEtf) !== 100 || etfTotal(rrspEtf) !== 100)) { setError('Make room values non-negative and ETF allocations total 100%, or skip this step.'); return; }
    setSaving(true);
    try {
      const db = clientSupabase();
      await saveProfile(db, userId, { monthly_income: numberValue(income), monthly_expenses: numberValue(expenses), emergency_fund: numberValue(emergency), emergency_target: numberValue(target), tfsa_room: skipOptional ? profile.tfsa_room : tfsa, rrsp_room: skipOptional ? profile.rrsp_room : rrsp });
      await saveAccountAllocations(db, userId, [{ account: 'TFSA', pct: numberValue(tfsaPct) / 100 }, { account: 'RRSP', pct: numberValue(rrspPct) / 100 }, { account: 'CASH', pct: numberValue(cashPct) / 100 }]);
      if (!skipOptional) await saveEtfAllocations(db, userId, [...tfsaEtf.map((row) => ({ account: 'TFSA' as const, instrument_id: numberValue(row.instrumentId), pct: numberValue(row.pct) / 100 })), ...rrspEtf.map((row) => ({ account: 'RRSP' as const, instrument_id: numberValue(row.instrumentId), pct: numberValue(row.pct) / 100 }))]);
      onComplete?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save setup'); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="setup-title"><Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-xl"><div className="flex items-start justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">Step {step} of 2</p><h2 id="setup-title" className="mt-1 text-xl font-semibold">{step === 1 ? 'Build your monthly plan' : 'Add contribution details'}</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{step === 1 ? 'A few numbers are enough to get your first plan.' : 'These details improve room checks and purchase recommendations.'}</p></div><button type="button" className="text-xl text-zinc-400 hover:text-zinc-700" onClick={() => onComplete?.()} aria-label="Close setup">×</button></div>
    {step === 1 ? <div className="mt-6 flex flex-col gap-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Monthly income (CAD)" htmlFor="setupIncome"><Input id="setupIncome" type="number" min={0} value={income} onChange={(e) => setIncome(e.target.value)} /></Field><Field label="Monthly expenses (CAD)" htmlFor="setupExpenses"><Input id="setupExpenses" type="number" min={0} value={expenses} onChange={(e) => setExpenses(e.target.value)} /></Field><Field label="Emergency fund today (CAD)" htmlFor="setupEmergency"><Input id="setupEmergency" type="number" min={0} value={emergency} onChange={(e) => setEmergency(e.target.value)} /></Field><Field label="Emergency fund target (CAD)" htmlFor="setupTarget"><Input id="setupTarget" type="number" min={0} value={target} onChange={(e) => setTarget(e.target.value)} /></Field></div><div><h3 className="text-sm font-semibold">Monthly allocation</h3><p className="mt-1 text-sm text-zinc-500">How your available surplus should be split. Total must equal 100%.</p><div className="mt-3 grid grid-cols-3 gap-3"><Field label="TFSA %" htmlFor="setupTfsa"><Input id="setupTfsa" type="number" min={0} max={100} value={tfsaPct} onChange={(e) => setTfsaPct(e.target.value)} /></Field><Field label="RRSP %" htmlFor="setupRrsp"><Input id="setupRrsp" type="number" min={0} max={100} value={rrspPct} onChange={(e) => setRrspPct(e.target.value)} /></Field><Field label="Cash %" htmlFor="setupCash"><Input id="setupCash" type="number" min={0} max={100} value={cashPct} onChange={(e) => setCashPct(e.target.value)} /></Field></div><p className={`mt-2 text-sm ${allocationTotal === 100 ? 'text-emerald-600' : 'text-red-600'}`}>Allocation total: {allocationTotal}%</p></div><div className="flex justify-end"><Button onClick={next}>Next</Button></div></div> : <div className="mt-6 flex flex-col gap-5"><div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><p><strong>TFSA room:</strong> {`$109,000 is a starting estimate only if you have been eligible and a resident of Canada since 2009 with no prior contributions. The 2026 annual room refresh is $7,000.`}</p><p className="mt-2">CRA room reflects start-of-year and reported information. Check it against your own records. TFSA annual room refreshes each January 1.</p></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="TFSA available room (CAD)" htmlFor="setupTfsaRoom"><Input id="setupTfsaRoom" type="number" min={0} value={tfsaRoom} onChange={(e) => setTfsaRoom(e.target.value)} /></Field><Field label="RRSP available room (CAD)" htmlFor="setupRrspRoom" hint="Required from your latest CRA Notice of Assessment."><Input id="setupRrspRoom" type="number" min={0} value={rrspRoom} onChange={(e) => setRrspRoom(e.target.value)} /></Field></div><p className="text-sm text-zinc-500">Find your RRSP deduction limit in <a className="text-blue-700 underline dark:text-blue-300" href="https://www.canada.ca/en/revenue-agency/services/e-services/e-services-individuals/account-individuals.html" target="_blank" rel="noreferrer">CRA My Account</a> or your latest Notice of Assessment.</p><div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{(['TFSA', 'RRSP'] as const).map((account) => { const rows = account === 'TFSA' ? tfsaEtf : rrspEtf; const setRows = account === 'TFSA' ? setTfsaEtf : setRrspEtf; return <div key={account}><h3 className="text-sm font-semibold">{account} ETF allocation</h3>{rows.map((row, i) => <div key={i} className="mt-2 flex gap-2"><Select aria-label={`${account} instrument ${i + 1}`} value={row.instrumentId} onChange={(e) => updateRow(rows, setRows, i, { instrumentId: e.target.value })}>{options}</Select><Input aria-label={`${account} percent ${i + 1}`} type="number" min={0} max={100} value={row.pct} onChange={(e) => updateRow(rows, setRows, i, { pct: e.target.value })} className="w-20" /><span className="self-center text-sm">%</span></div>)}<p className={`mt-1 text-xs ${etfTotal(rows) === 100 ? 'text-emerald-600' : 'text-red-600'}`}>Total {etfTotal(rows)}%</p></div>; })}</div><div className="flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><div className="flex gap-2"><Button variant="secondary" onClick={() => finish(true)} disabled={saving}>Skip for now</Button><Button onClick={() => finish(false)} disabled={saving}>{saving ? 'Saving...' : 'Finish setup'}</Button></div></div></div>}
    {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
  </Card></div>;
}
