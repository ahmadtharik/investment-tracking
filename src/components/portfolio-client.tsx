'use client';

import { useEffect, useMemo, useState } from 'react';
import { HoldingsForm } from '@/components/forms/holdings-form';
import { PortfolioAllocation, type AllocationDatum } from '@/components/portfolio-allocation';
import { formatCAD } from '@/lib/format';
import type { HoldingWithInstrument, InstrumentRow } from '@/lib/db/queries';

type Quote = { price: number; currency: string; asOf?: string };
export function PortfolioClient({ userId, instruments, initialHoldings, initialQuotes }: { userId: string; instruments: InstrumentRow[]; initialHoldings: HoldingWithInstrument[]; initialQuotes: Record<string, Quote> }) {
  const [holdings, setHoldings] = useState(initialHoldings);
  const [quotes, setQuotes] = useState(initialQuotes);
  const tickers = useMemo(() => [...new Set(holdings.map((h) => h.ticker).filter(Boolean))], [holdings]);
  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;
    const refresh = () => fetch(`/api/market/quotes?tickers=${tickers.join(',')}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled && data?.quotes) setQuotes(data.quotes); })
      .catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [tickers]);
  const value = (h: HoldingWithInstrument) => { const q = quotes[h.ticker]; const native = h.units * (q?.price ?? 1); return h.currency === 'USD' ? native * h.fx_rate : native; };
  const total = holdings.reduce((sum, h) => sum + value(h), 0);
  const by = (key: 'account' | 'currency'): AllocationDatum[] => Object.entries(holdings.reduce<Record<string, number>>((a, h) => { const k = key === 'account' ? h.account : h.currency; a[k] = (a[k] ?? 0) + value(h); return a; }, {})).map(([k, v]) => ({ key: k, name: k === 'CASH' ? 'Cash' : k, value: v }));
  return <><div className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total portfolio value</p><p className="mt-1 text-3xl font-semibold tabular-nums">{formatCAD(total)}</p><p className="mt-1 text-xs text-zinc-500">CAD value based on latest available quotes</p></div><div className="mt-6"><PortfolioAllocation byAccount={by('account')} byCurrency={by('currency')} /></div><div className="mt-6"><HoldingsForm userId={userId} instruments={instruments} holdings={holdings} quotes={quotes} onChanged={setHoldings} /></div></>;
}
