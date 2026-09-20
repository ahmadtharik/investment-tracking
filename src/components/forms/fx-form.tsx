'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { convertCadToUsd, annualFxCost, FX_SPREADS, type FxProviderKey } from '@/lib/engine/fx';
import { saveFxPrefs } from '@/lib/db/queries';
import { clientSupabase } from '@/lib/supabase/client';
import { formatCAD, formatUSD } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useChartColors } from '@/components/charts/theme';

type FxFormProps = { userId: string; midRate: number; asOf?: string; initialAmount: number; initialProvider: FxProviderKey; initialRate?: number | null; usdTickers: string[] };

const providerNames: Record<FxProviderKey, string> = { TD: 'TD (1.5% spread)', WEALTHSIMPLE: 'Wealthsimple (1.4% spread)', CUSTOM: 'Custom rate' };
const money = (n: number) => n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FxForm({ userId, midRate, asOf, initialAmount, initialProvider, initialRate, usdTickers }: FxFormProps) {
  const router = useRouter();
  const colors = useChartColors();
  const [amount, setAmount] = useState(String(initialAmount || 550));
  const [provider, setProvider] = useState<FxProviderKey>(initialProvider || 'TD');
  const [customRate, setCustomRate] = useState(String(initialRate && initialProvider === 'CUSTOM' ? initialRate : midRate));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const cad = Math.max(0, Number(amount) || 0);
  const rate = provider === 'CUSTOM' ? Math.max(0.000001, Number(customRate) || midRate) : midRate;
  const config = { provider, rate };
  const result = useMemo(() => convertCadToUsd(cad, midRate, config), [cad, midRate, provider, rate]);
  const annual = useMemo(() => annualFxCost(cad, midRate, config), [cad, midRate, provider, rate]);
  const chartData = useMemo(() => (['TD', 'WEALTHSIMPLE', 'CUSTOM'] as FxProviderKey[]).map((key) => {
    const r = convertCadToUsd(cad, midRate, { provider: key, rate: key === 'CUSTOM' ? Math.max(0.000001, Number(customRate) || midRate) : midRate });
    return { provider: key === 'WEALTHSIMPLE' ? 'Wealthsimple' : key === 'CUSTOM' ? 'Custom' : 'TD', usd: r.usdReceived, cost: r.fxCostCad };
  }), [cad, midRate, customRate]);

  async function save() {
    if (!amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 0 || (provider === 'CUSTOM' && (!customRate.trim() || !Number.isFinite(Number(customRate)) || Number(customRate) <= 0))) { setMessage('Enter a valid amount and rate.'); return; }
    setSaving(true); setMessage('');
    try {
      const tickers = usdTickers.length ? usdTickers : ['VTI'];
      await saveFxPrefs(clientSupabase(), userId, tickers.map((ticker) => ({ ticker, provider, custom_rate: rate })));
      router.refresh();
      setMessage('Saved. The dashboard will use this provider and rate for USD purchases.');
    } catch { setMessage('Could not save your preference. Check your connection and try again.'); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <Card title="Convert CAD to USD" description="Compare the cost of converting your monthly USD investment amount.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="CAD amount" htmlFor="fx-amount" hint="Monthly amount to convert."><Input id="fx-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Provider" htmlFor="fx-provider"><Select id="fx-provider" value={provider} onChange={(e) => setProvider(e.target.value as FxProviderKey)}>{(Object.keys(providerNames) as FxProviderKey[]).map((key) => <option key={key} value={key}>{providerNames[key]}</option>)}</Select></Field>
        <Field label="Live mid-rate" hint="CAD per USD, from Yahoo CAD=X."><div className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700">{midRate.toFixed(4)} <span className="text-xs text-zinc-400">CAD/USD</span></div></Field>
        {provider === 'CUSTOM' ? <Field label="Custom rate" htmlFor="fx-custom" hint="CAD per USD."><Input id="fx-custom" type="number" min="0.000001" step="0.0001" value={customRate} onChange={(e) => setCustomRate(e.target.value)} /></Field> : <div />}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={save} loading={saving} loadingLabel="Saving…">Save preference</Button>{message && <p className="text-sm text-zinc-500" role="status">{message}</p>}</div>
      <p className="mt-3 text-xs text-zinc-400">{asOf ? `Rate updated ${new Date(asOf).toLocaleString('en-CA')}.` : 'Live rate unavailable, using the latest available rate.'}</p>
    </Card>

    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Your conversion" description={`Using ${providerNames[provider]}`}>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
          <div><dt className="text-zinc-500">USD received</dt><dd className="mt-1 text-lg font-semibold">{formatUSD(result.usdReceived)}</dd></div>
          <div><dt className="text-zinc-500">Conversion cost</dt><dd className="mt-1 text-lg font-semibold">{money(result.fxCostCad)}</dd></div>
          <div><dt className="text-zinc-500">Monthly FX cost</dt><dd className="mt-1 font-medium">{money(annual.monthlyCost)}</dd></div>
          <div><dt className="text-zinc-500">Annual FX cost</dt><dd className="mt-1 font-medium">{money(annual.annualCost)}</dd></div>
          <div><dt className="text-zinc-500">Effective rate</dt><dd className="mt-1 font-medium">{result.effectiveRate.toFixed(4)} CAD/USD</dd></div>
        </dl>
        <p className="mt-5 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">At this spread you pay <strong>{money(result.fxCostCad * 1000 / (cad || 1))}</strong> CAD per 1,000 converted (≈ {(FX_SPREADS[provider] * 100).toFixed(2)}%).</p>
      </Card>
      <Card title="Provider comparison" description="Same CAD amount, different provider spreads.">
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}><CartesianGrid stroke={colors.grid} vertical={false} /><XAxis dataKey="provider" tick={{ fontSize: 11, fill: colors.axis }} axisLine={{ stroke: colors.axis }} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} width={70} /><Tooltip formatter={(value, name) => [name === 'USD received' ? formatUSD(Number(value)) : formatCAD(Number(value)), String(name)]} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="usd" name="USD received" fill={colors.TFSA} isAnimationActive={false} radius={[2, 2, 0, 0]} /><Bar dataKey="cost" name="FX cost (CAD)" fill={colors.RRSP} isAnimationActive={false} radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div>
      </Card>
    </div>
  </div>;
}
