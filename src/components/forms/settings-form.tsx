'use client';

import { useState } from 'react';
import { z } from 'zod';
import { clientSupabase } from '@/lib/supabase/client';
import {
  saveAccountAllocations,
  saveEtfAllocations,
  saveProfile,
  type AccountAllocRow,
  type EtfAllocRow,
  type InstrumentRow,
  type Profile,
} from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { AllocationBar } from '@/components/allocation-bar';
import { formatCAD } from '@/lib/format';

// ── Validation ────────────────────────────────────────────────────────

const settingsSchema = z
  .object({
    monthlyIncome: z.coerce.number().min(0),
    monthlyExpenses: z.coerce.number().min(0),
    emergencyFund: z.coerce.number().min(0),
    emergencyTarget: z.coerce.number().min(0),
    tfsaPct: z.coerce.number().min(0).max(100),
    rrspPct: z.coerce.number().min(0).max(100),
    cashPct: z.coerce.number().min(0).max(100),
    tfsaEtf: z
      .array(z.object({ instrumentId: z.coerce.number().int(), pct: z.coerce.number().min(0).max(100) }))
      .min(1),
    rrspEtf: z
      .array(z.object({ instrumentId: z.coerce.number().int(), pct: z.coerce.number().min(0).max(100) }))
      .min(1),
  })
  .refine((d) => Math.abs(d.tfsaPct + d.rrspPct + d.cashPct - 100) < 0.1, {
    message: 'Account allocation must total 100%',
    path: ['cashPct'],
  })
  .refine((d) => Math.abs(d.tfsaEtf.reduce((t, r) => t + r.pct, 0) - 100) < 0.1, {
    message: 'TFSA ETF allocation must total 100%',
  })
  .refine((d) => Math.abs(d.rrspEtf.reduce((t, r) => t + r.pct, 0) - 100) < 0.1, {
    message: 'RRSP ETF allocation must total 100%',
  });

interface EtfRowState {
  instrumentId: string; // select value ("" = not chosen)
  pct: string;
}

interface SettingsFormProps {
  userId: string;
  profile: Profile;
  accountAlloc: AccountAllocRow[];
  etfAlloc: EtfAllocRow[];
  instruments: InstrumentRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────

const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const pctOf = (rows: AccountAllocRow[], account: AccountAllocRow['account']): string => {
  const row = rows.find((r) => r.account === account);
  return row ? String(Math.round(row.pct * 1000) / 10) : '0';
};

const toEtfRows = (rows: EtfAllocRow[], account: 'TFSA' | 'RRSP', firstInstrumentId: string): EtfRowState[] => {
  const existing = rows.filter((r) => r.account === account);
  if (existing.length === 0) return [{ instrumentId: firstInstrumentId, pct: '100' }];
  return existing.map((r) => ({
    instrumentId: String(r.instrument_id),
    pct: String(Math.round(r.pct * 1000) / 10),
  }));
};

const totalsReadout = (value: number, key: string) => (
  <span
    className={`text-sm font-medium ${
      Math.abs(value - 100) < 0.1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
    }`}
  >
    {key}: totals {Math.round(value * 10) / 10}%
  </span>
);

// ── Component ─────────────────────────────────────────────────────────

export function SettingsForm({ userId, profile, accountAlloc, etfAlloc, instruments }: SettingsFormProps) {
  const firstInstrumentId = instruments[0] ? String(instruments[0].id) : '';

  const [monthlyIncome, setMonthlyIncome] = useState(String(profile.monthly_income ?? ''));
  const [monthlyExpenses, setMonthlyExpenses] = useState(String(profile.monthly_expenses ?? ''));
  const [emergencyFund, setEmergencyFund] = useState(String(profile.emergency_fund ?? ''));
  const [emergencyTarget, setEmergencyTarget] = useState(String(profile.emergency_target ?? ''));
  const [tfsaPct, setTfsaPct] = useState(pctOf(accountAlloc, 'TFSA'));
  const [rrspPct, setRrspPct] = useState(pctOf(accountAlloc, 'RRSP'));
  const [cashPct, setCashPct] = useState(pctOf(accountAlloc, 'CASH'));
  const [tfsaEtf, setTfsaEtf] = useState<EtfRowState[]>(() => toEtfRows(etfAlloc, 'TFSA', firstInstrumentId));
  const [rrspEtf, setRrspEtf] = useState<EtfRowState[]>(() => toEtfRows(etfAlloc, 'RRSP', firstInstrumentId));

  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const accountTotal = num(tfsaPct) + num(rrspPct) + num(cashPct);
  const tfsaEtfTotal = tfsaEtf.reduce((t, r) => t + num(r.pct), 0);
  const rrspEtfTotal = rrspEtf.reduce((t, r) => t + num(r.pct), 0);
  const monthlySurplus = Math.max(0, num(monthlyIncome) - num(monthlyExpenses));
  const accountAmount = (pct: string) => monthlySurplus * num(pct) / 100;

  const setEtfRow = (
    setter: (rows: EtfRowState[]) => void,
    rows: EtfRowState[],
    index: number,
    patch: Partial<EtfRowState>
  ) => {
    setter(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addEtfRow = (setter: (rows: EtfRowState[]) => void, rows: EtfRowState[]) => {
    setter([...rows, { instrumentId: firstInstrumentId, pct: '0' }]);
  };

  const removeEtfRow = (setter: (rows: EtfRowState[]) => void, rows: EtfRowState[], index: number) => {
    setter(rows.filter((_, i) => i !== index));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    const parsed = settingsSchema.safeParse({
      monthlyIncome,
      monthlyExpenses,
      emergencyFund,
      emergencyTarget,
      tfsaPct: num(tfsaPct),
      rrspPct: num(rrspPct),
      cashPct: num(cashPct),
      tfsaEtf,
      rrspEtf,
    });
    if (!parsed.success) {
      const next: Partial<Record<string, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length > 0 ? String(issue.path[0]) : '_form';
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    const d = parsed.data;
    setSaving(true);
    try {
      const db = clientSupabase();
      await saveProfile(db, userId, {
        monthly_income: d.monthlyIncome,
        monthly_expenses: d.monthlyExpenses,
        emergency_fund: d.emergencyFund,
        emergency_target: d.emergencyTarget,
        // Room is managed on the Accounts page — preserve the stored values.
        tfsa_room: profile.tfsa_room,
        rrsp_room: profile.rrsp_room,
      });
      await saveAccountAllocations(db, userId, [
        { account: 'TFSA', pct: d.tfsaPct / 100 },
        { account: 'RRSP', pct: d.rrspPct / 100 },
        { account: 'CASH', pct: d.cashPct / 100 },
      ]);
      await saveEtfAllocations(db, userId, [
        ...d.tfsaEtf.map((r) => ({ account: 'TFSA' as const, instrument_id: r.instrumentId, pct: r.pct / 100 })),
        ...d.rrspEtf.map((r) => ({ account: 'RRSP' as const, instrument_id: r.instrumentId, pct: r.pct / 100 })),
      ]);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  const instrumentOptions = (
    <>
      {instruments.map((i) => (
        <option key={i.id} value={String(i.id)}>
        {i.ticker} / {i.name}
        </option>
      ))}
    </>
  );

  const etfAllocationBlock = (
    title: string,
    description: string,
    rows: EtfRowState[],
    setter: (rows: EtfRowState[]) => void,
    total: number,
    totalKey: string,
    rowErrors: Record<number, string> | null
  ) => (
    <Card title={title} description={description} className="mt-6">
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:grid-cols-[minmax(14rem,1fr)_6rem_auto_auto]">
            <Select
              value={row.instrumentId}
              onChange={(e) => setEtfRow(setter, rows, i, { instrumentId: e.target.value })}
              className="flex-1"
              aria-label={`${title} instrument ${i + 1}`}
            >
              {instrumentOptions}
            </Select>
            <Input
              type="number"
              min={0}
              max={100}
              value={row.pct}
              onChange={(e) => setEtfRow(setter, rows, i, { pct: e.target.value })}
              className="w-24"
              aria-label={`${title} percent ${i + 1}`}
            />
            <span className="text-sm text-zinc-400">%</span>
            <Button
              variant="danger"
              onClick={() => removeEtfRow(setter, rows, i)}
              disabled={rows.length <= 1}
              title="Remove row"
              className="px-2"
            >
              ✕
            </Button>
            <span className="col-span-full text-xs text-zinc-500 sm:col-span-1 sm:col-start-2">Monthly plan: {formatCAD(accountAmount(title.startsWith('TFSA') ? tfsaPct : rrspPct) * num(row.pct) / 100)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => addEtfRow(setter, rows)}>
            + Add instrument
          </Button>
          {totalsReadout(total, totalKey)}
        </div>
        {rowErrors &&
          Object.entries(rowErrors).map(([i, msg]) => (
            <p key={i} className="text-xs text-red-600 dark:text-red-400">
              {msg}
            </p>
          ))}
        <AllocationBar title={`${title} monthly plan`} total={total} segments={rows.map((row, index) => ({ label: instruments.find((instrument) => String(instrument.id) === row.instrumentId)?.ticker ?? `Instrument ${index + 1}`, pct: num(row.pct), amount: accountAmount(title.startsWith('TFSA') ? tfsaPct : rrspPct) * num(row.pct) / 100, color: title.startsWith('TFSA') ? ['#4d8fbd', '#76abc9', '#9bc7dc'][index % 3] : ['#d8894c', '#e5a16f', '#efbd92'][index % 3] }))} />
      </div>
    </Card>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col">
      <Card title="Income and expenses" description="Monthly figures in CAD. Surplus equals income minus expenses.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Monthly income" htmlFor="monthlyIncome" error={errors.monthlyIncome}>
            <Input
              id="monthlyIncome"
              type="number"
              min={0}
              step="any"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
            />
          </Field>
          <Field label="Monthly expenses" htmlFor="monthlyExpenses" error={errors.monthlyExpenses}>
            <Input
              id="monthlyExpenses"
              type="number"
              min={0}
              step="any"
              value={monthlyExpenses}
              onChange={(e) => setMonthlyExpenses(e.target.value)}
            />
          </Field>
          <Field
            label="Emergency fund (current)"
            htmlFor="emergencyFund"
            hint="Cash you already have set aside."
            error={errors.emergencyFund}
          >
            <Input
              id="emergencyFund"
              type="number"
              min={0}
              step="any"
              value={emergencyFund}
              onChange={(e) => setEmergencyFund(e.target.value)}
            />
          </Field>
          <Field
            label="Emergency fund (target)"
            htmlFor="emergencyTarget"
            hint="For example, 3 to 6 months of expenses. Surplus fills this before investing."
            error={errors.emergencyTarget}
          >
            <Input
              id="emergencyTarget"
              type="number"
              min={0}
              step="any"
              value={emergencyTarget}
              onChange={(e) => setEmergencyTarget(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Account allocation"
        description="How each month's surplus splits across TFSA, RRSP, and cash. Must total 100%."
        className="mt-6"
      >
        <div className="grid grid-cols-3 gap-4">
          <Field label="TFSA %" htmlFor="tfsaPct">
            <Input id="tfsaPct" type="number" min={0} max={100} value={tfsaPct} onChange={(e) => setTfsaPct(e.target.value)} />
          </Field>
          <Field label="RRSP %" htmlFor="rrspPct">
            <Input id="rrspPct" type="number" min={0} max={100} value={rrspPct} onChange={(e) => setRrspPct(e.target.value)} />
          </Field>
          <Field label="Cash %" htmlFor="cashPct" error={errors.cashPct}>
            <Input id="cashPct" type="number" min={0} max={100} value={cashPct} onChange={(e) => setCashPct(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">{totalsReadout(accountTotal, 'Account allocation')}</div>
        <AllocationBar title="Account allocation" total={accountTotal} segments={[{ label: 'TFSA', pct: num(tfsaPct), amount: accountAmount(tfsaPct), color: '#4d8fbd' }, { label: 'RRSP', pct: num(rrspPct), amount: accountAmount(rrspPct), color: '#d8894c' }, { label: 'Cash', pct: num(cashPct), amount: accountAmount(cashPct), color: '#54b7b1' }]} />
      </Card>

      {etfAllocationBlock(
        'TFSA ETF allocation',
        'Which instruments each dollar of the TFSA slice buys. Must total 100%.',
        tfsaEtf,
        setTfsaEtf,
        tfsaEtfTotal,
        'TFSA',
        errors.tfsaEtf ? { 0: String(errors.tfsaEtf) } : null
      )}
      {etfAllocationBlock(
        'RRSP ETF allocation',
        'Which instruments each dollar of the RRSP slice buys. Must total 100%.',
        rrspEtf,
        setRrspEtf,
        rrspEtfTotal,
        'RRSP',
        errors.rrspEtf ? { 0: String(errors.rrspEtf) } : null
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button type="submit" loading={saving} loadingLabel="Saving…">
          Save settings
        </Button>
        {savedAt && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved ✓</span>}
        {saveError && <span className="text-sm text-red-600 dark:text-red-400">{saveError}</span>}
        {errors._form && <span className="text-sm text-red-600 dark:text-red-400">{errors._form}</span>}
      </div>
    </form>
  );
}
