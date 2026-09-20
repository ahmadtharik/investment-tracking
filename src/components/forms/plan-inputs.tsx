'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';
import { saveProfile, saveEtfAllocations, type Profile, type EtfAllocRow, type InstrumentRow, type AccountAllocRow } from '@/lib/db/queries';
import { formatCAD } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const fields = [
  ['monthly_income', 'Monthly income'], ['monthly_expenses', 'Monthly expenses'],
  ['emergency_fund', 'Emergency fund balance'], ['emergency_target', 'Emergency fund target'],
] as const;
type Baseline = Record<(typeof fields)[number][0], number>;

export function FinancialBaseline({ userId, profile }: { userId: string; profile: Profile }) {
  const router = useRouter();
  const initial = Object.fromEntries(fields.map(([key]) => [key, profile[key] ?? 0])) as Baseline;
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.map(([key]) => [key, String(initial[key])])));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const values = editing ? Object.fromEntries(fields.map(([key]) => [key, Number(draft[key]) || 0])) as Baseline : saved;
  const surplus = values.monthly_income - values.monthly_expenses;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (fields.some(([key]) => draft[key].trim() === '' || !Number.isFinite(Number(draft[key])) || Number(draft[key]) < 0)) { setError('Enter a non-negative amount for each field. Use 0 if it does not apply.'); return; }
    setBusy(true);
    try {
      await saveProfile(clientSupabase(), userId, values);
      setSaved(values); setEditing(false); setNotice('Financial baseline saved.'); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your financial baseline.'); }
    finally { setBusy(false); }
  }
  function cancel() { setDraft(Object.fromEntries(fields.map(([key]) => [key, String(saved[key])]))); setEditing(false); setError(''); }
  return <div id="financial-baseline" className="mt-4 scroll-mt-24"><Card className="!p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-[var(--text-primary)]">Financial baseline</h2><p className="mt-1 text-xs text-[var(--text-muted)]">The starting point for your monthly plan. All amounts in CAD.</p></div>{!editing && <Button variant="secondary" onClick={()=>{setEditing(true);setNotice('');}}>Edit baseline</Button>}</div>
    <form onSubmit={submit} className="mt-4"><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{fields.map(([key,label])=><div key={key} className="min-w-0"><label htmlFor={`baseline-${key}`} className="text-xs font-medium text-[var(--text-muted)]">{label}</label>{editing ? <div className="relative mt-2"><span aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 text-sm text-[var(--text-muted)]">$</span><Input autoFocus={key === 'monthly_income'} id={`baseline-${key}`} type="number" step="0.01" min={0} required value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})} className="pl-7" /></div> : <p className="mt-2 text-xl font-bold tabular-nums text-[var(--text-primary)]">{formatCAD(saved[key])}</p>}</div>)}</fieldset>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-[var(--color-primary-subtle)] px-4 py-3"><div><p className="text-xs font-semibold text-[var(--text-muted)]">{editing ? 'Monthly surplus · preview' : 'Monthly surplus'}</p><p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-primary)]">{formatCAD(Math.max(0,surplus))}</p></div><p className="max-w-sm text-xs leading-5 text-[var(--text-muted)]">{surplus < 0 ? 'Expenses exceed income. Your available monthly allocation is $0.' : 'Income minus expenses. Your saved account percentages determine how this amount is allocated.'}</p></div>
      {editing && <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={cancel}>Cancel</Button><Button type="submit" loading={busy} loadingLabel="Saving…">Save changes</Button></div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}{notice && <p role="status" className="mt-3 text-xs text-emerald-600">{notice}</p>}
    </form>
  </Card></div>;
}

type DraftRow = { account: 'TFSA' | 'RRSP'; instrument: string; pct: string };
const asDraft = (rows: EtfAllocRow[]): DraftRow[] => rows.map(row=>({account:row.account, instrument:String(row.instrument_id), pct:String(Math.round(row.pct * 10000) / 100)}));

export function PlannedPurchases({ userId, allocations, instruments, accountAlloc, surplus }: { userId: string; allocations: EtfAllocRow[]; instruments: InstrumentRow[]; accountAlloc: AccountAllocRow[]; surplus: number }) {
  const router = useRouter();
  const [saved, setSaved] = useState(()=>asDraft(allocations));
  const [draft, setDraft] = useState(()=>asDraft(allocations));
  const [editing,setEditing] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const rows = editing ? draft : saved;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if(busy) return; setError('');
    for (const account of ['TFSA','RRSP'] as const) {
      const items = draft.filter(row=>row.account === account);
      if (!items.length) continue;
      if (items.some(row=>!instruments.some(i=>i.id===Number(row.instrument)) || row.pct.trim()==='' || !Number.isFinite(Number(row.pct)) || Number(row.pct)<0 || Number(row.pct)>100) || new Set(items.map(row=>row.instrument)).size!==items.length || Math.abs(items.reduce((sum,row)=>sum+Number(row.pct),0)-100)>0.001) { setError(`${account}: choose distinct investments and make percentages total 100%.`); return; }
    }
    setBusy(true);
    try {
      await saveEtfAllocations(clientSupabase(),userId,draft.map(row=>({account:row.account,instrument_id:Number(row.instrument),pct:Number(row.pct)/100})));
      setSaved(draft.map(row=>({...row}))); setEditing(false); setNotice('Planned purchases saved.'); router.refresh();
    } catch(cause) { setError(cause instanceof Error ? cause.message : 'Could not save planned purchases.'); }
    finally { setBusy(false); }
  }
  return <section id="planned-purchases" className="mt-4 scroll-mt-24"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-bold text-[var(--text-primary)]">Planned purchases</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Divide each account’s allocation among investments. This does not change your actual holdings or place trades.</p></div>{!editing && <Button variant="secondary" onClick={()=>{setDraft(saved.map(row=>({...row})));setEditing(true);setNotice('');}}>Edit planned purchases</Button>}</div>
    <form onSubmit={submit}><fieldset disabled={busy} className="grid min-w-0 gap-3 lg:grid-cols-2">{(['TFSA','RRSP'] as const).map(account=>{const monthly=surplus*(accountAlloc.find(a=>a.account===account)?.pct??0);const color=account==='TFSA'?'bg-blue-500':'bg-orange-400';const total=rows.filter(row=>row.account===account).reduce((sum,row)=>sum+(Number(row.pct)||0),0);return <Card key={account} className="!p-5"><div className="flex items-center justify-between"><h3 className="font-bold text-[var(--text-primary)]">{account}</h3><span className="text-xs text-[var(--text-muted)]">{formatCAD(monthly)} / month before room caps</span></div><div className="mt-4 space-y-4">{rows.map((row,index)=>row.account!==account?null:<div key={index} className="rounded-xl border border-[var(--border)] p-3">{editing ? <div className="grid grid-cols-[minmax(0,1fr)_80px_auto] gap-2"><Select aria-label={`${account} investment ${index+1}`} value={row.instrument} onChange={e=>setDraft(draft.map((r,i)=>i===index?{...r,instrument:e.target.value}:r))}><option value="">Select investment</option>{instruments.map(i=><option key={i.id} value={i.id}>{i.ticker} · {i.name}</option>)}</Select><Input aria-label={`${account} percentage ${index+1}`} type="number" min={0} max={100} step="0.01" value={row.pct} onChange={e=>setDraft(draft.map((r,i)=>i===index?{...r,pct:e.target.value}:r))} /><button type="button" aria-label={`Remove ${account} investment ${index+1}`} className="px-1 text-[var(--text-muted)] hover:text-red-600" onClick={()=>setDraft(draft.filter((_,i)=>i!==index))}>×</button></div> : <p className="text-sm font-semibold">{instruments.find(i=>i.id===Number(row.instrument))?.ticker ?? 'Investment unavailable'}</p>}<div className="mt-3 flex items-center justify-between text-xs"><b className="tabular-nums">{formatCAD(monthly*(Number(row.pct)||0)/100)}</b><span className="text-[var(--text-muted)]">{Number(row.pct)||0}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{width:`${Math.min(100,Math.max(0,Number(row.pct)||0))}%`}} /></div></div>)}</div>{!rows.some(row=>row.account===account) && <p className="py-6 text-sm text-[var(--text-muted)]">No planned purchases. Add investments when you’re ready.</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">{editing ? <Button variant="secondary" disabled={!instruments.length} onClick={()=>setDraft([...draft,{account,instrument:'',pct:'0'}])}>+ Add investment</Button> : <span className="text-xs text-[var(--text-muted)]">Planned allocation</span>}<span className="text-sm font-semibold tabular-nums">{total.toFixed(2).replace(/\.00$/,'')}%</span></div></Card>;})}</fieldset>
      {editing && <div className="mt-3 flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={()=>{setDraft(saved.map(row=>({...row})));setEditing(false);setError('');}}>Cancel</Button><Button type="submit" loading={busy} loadingLabel="Saving…">Save changes</Button></div>}{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}{notice && <p role="status" className="mt-3 text-xs text-emerald-600">{notice}</p>}
    </form>
  </section>;
}
