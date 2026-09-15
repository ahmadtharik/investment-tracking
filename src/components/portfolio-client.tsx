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
    return () => { cancelled = true; };
  }, [tickers]);
  const value = (h: HoldingWithInstrument) => { const q = quotes[h.ticker]; const native = q ? h.units * q.price : h.balance_native; return h.currency === 'USD' ? native * h.fx_rate : native; };
  const total = holdings.reduce((sum, h) => sum + value(h), 0);
  const by = (key: 'account' | 'currency'): AllocationDatum[] => Object.entries(holdings.reduce<Record<string, number>>((a, h) => { const k = key === 'account' ? h.account : h.currency; a[k] = (a[k] ?? 0) + value(h); return a; }, {})).map(([k, v]) => ({ key: k, name: k === 'CASH' ? 'Cash' : k, value: v }));
  const latestQuote = Object.values(quotes).map((quote) => quote.asOf).filter(Boolean).sort().at(-1);
  const missingQuotes = holdings.some((holding) => !quotes[holding.ticker]);
  return <><div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_8px_30px_rgba(53,48,36,0.04)]"><p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Total portfolio value</p><p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-[var(--ink)]">{formatCAD(total)}</p><p className="mt-2 text-xs text-[var(--muted)]">{missingQuotes ? 'Some live quotes are temporarily unavailable. Those holdings use their recorded native balance until pricing resumes.' : `CAD value based on latest available quotes${latestQuote ? `, last updated ${new Date(latestQuote).toLocaleString()}` : ''}.`}</p></div><div className="mt-6"><PortfolioAllocation byAccount={by('account')} byCurrency={by('currency')} /></div><div className="mt-6"><HoldingsForm userId={userId} instruments={instruments} holdings={holdings} quotes={quotes} onChanged={setHoldings} /></div></>;
}
