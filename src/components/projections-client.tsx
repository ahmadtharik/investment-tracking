'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ProjectionChart } from '@/components/projection-chart';
import { BacktestChart } from '@/components/backtest-chart';
import { futureValue, projectSeries, type ProjectionInput } from '@/lib/engine/projection';
import { runBacktest, type BacktestPoint } from '@/lib/engine/backtest';
import { formatCAD } from '@/lib/format';
import type { InstrumentRow } from '@/lib/db/queries';

type HistoryPoint = { date: string; close: number };

export function ProjectionsClient({ instruments, initialTicker, initialPoints, initialMonthly }: { instruments: InstrumentRow[]; initialTicker: string; initialPoints: HistoryPoint[]; initialMonthly: number }) {
  const [starting, setStarting] = useState('0');
  const [monthly, setMonthly] = useState(String(Math.round(initialMonthly)));
  const [annualReturn, setAnnualReturn] = useState('7');
  const [period, setPeriod] = useState('10');
  const projectionInput: ProjectionInput = { starting: Number(starting) || 0, monthlyContribution: Number(monthly) || 0, annualReturn: (Number(annualReturn) || 0) / 100 };
  const series = useMemo(() => projectSeries(projectionInput, 360), [starting, monthly, annualReturn]);
  const horizons = [5, 10, 20, 30];
  const [ticker, setTicker] = useState(initialTicker);
  const [backtestPeriod, setBacktestPeriod] = useState<'1y' | '2y' | '5y' | 'max'>('5y');
  const [backtestMonthly, setBacktestMonthly] = useState(String(Math.round(initialMonthly)));
  const [history, setHistory] = useState(initialPoints);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const backtest = useMemo<BacktestPoint[]>(() => runBacktest({ monthlyAmount: Number(backtestMonthly) || 0, points: history }), [backtestMonthly, history]);
  async function loadHistory(nextTicker: string, nextPeriod: '1y' | '2y' | '5y' | 'max') {
    setTicker(nextTicker); setBacktestPeriod(nextPeriod); setLoadingHistory(true); setHistoryError(null);
    try { const response = await fetch(`/api/market/history?ticker=${encodeURIComponent(nextTicker)}&period=${nextPeriod}`); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? 'Could not load history'); setHistory(body.points ?? []); }
    catch (error) { setHistoryError(error instanceof Error ? error.message : 'Could not load history'); }
    finally { setLoadingHistory(false); }
  }
  const latest = backtest.at(-1);
  const gain = latest ? latest.value - latest.invested : 0;
  return <div className="mt-6 flex flex-col gap-6">
    <Card title="Projection" description="Estimate future value using a fixed annual return and monthly contribution.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4"><Field label="Starting portfolio" htmlFor="projectionStarting"><Input id="projectionStarting" type="number" min={0} step="any" value={starting} onChange={(e) => setStarting(e.target.value)} /></Field><Field label="Monthly contribution" htmlFor="projectionMonthly"><Input id="projectionMonthly" type="number" min={0} step="any" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></Field><Field label={`Annual return (${annualReturn}%)`} htmlFor="projectionReturn"><Input id="projectionReturn" type="range" min={0} max={12} step={0.1} value={annualReturn} onChange={(e) => setAnnualReturn(e.target.value)} className="mt-3" /></Field><Field label="Chart horizon" htmlFor="projectionPeriod"><Select id="projectionPeriod" value={period} onChange={(e) => setPeriod(e.target.value)}>{[5, 10, 20, 30].map((year) => <option key={year} value={year}>{year} years</option>)}</Select></Field></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-zinc-500"><tr><th className="pb-2">Horizon</th><th className="pb-2">Value</th><th className="pb-2">Contributed</th><th className="pb-2">Growth</th></tr></thead><tbody>{horizons.map((year) => { const row = futureValue(projectionInput, year); return <tr key={year} className="border-t border-zinc-200 dark:border-zinc-800"><td className="py-2">{year} years</td><td className="py-2">{formatCAD(row.value)}</td><td className="py-2">{formatCAD(row.contributed)}</td><td className="py-2">{formatCAD(row.growth)}</td></tr>; })}</tbody></table></div>
      <div className="mt-5"><ProjectionChart data={series.slice(0, Number(period) * 12 + 1)} /></div>
    </Card>
    <Card title="What if you had invested?" description="Replay dollar-cost averaging against monthly historical closes.">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Field label="Instrument" htmlFor="backtestTicker"><Select id="backtestTicker" value={ticker} onChange={(e) => loadHistory(e.target.value, backtestPeriod)}>{instruments.map((i) => <option key={i.ticker} value={i.ticker}>{i.ticker} — {i.name}</option>)}</Select></Field><Field label="History" htmlFor="backtestPeriod"><Select id="backtestPeriod" value={backtestPeriod} onChange={(e) => loadHistory(ticker, e.target.value as typeof backtestPeriod)}>{['1y', '2y', '5y', 'max'].map((p) => <option key={p} value={p}>{p}</option>)}</Select></Field><Field label="Monthly amount" htmlFor="backtestMonthly"><Input id="backtestMonthly" type="number" min={0} step="any" value={backtestMonthly} onChange={(e) => setBacktestMonthly(e.target.value)} /></Field></div>
      {loadingHistory && <p className="mt-3 text-sm text-zinc-500">Loading market history…</p>}{historyError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{historyError}</p>}
      {latest && <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4"><div><p className="text-xs uppercase text-zinc-500">Total invested</p><p className="mt-1 font-semibold">{formatCAD(latest.invested)}</p></div><div><p className="text-xs uppercase text-zinc-500">Value today</p><p className="mt-1 font-semibold">{formatCAD(latest.value)}</p></div><div><p className="text-xs uppercase text-zinc-500">Gain</p><p className={`mt-1 font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCAD(gain)}</p></div><div><p className="text-xs uppercase text-zinc-500">Gain %</p><p className={`mt-1 font-semibold ${gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{latest.invested ? `${((gain / latest.invested) * 100).toFixed(1)}%` : '—'}</p></div></div>}
      {backtest.length > 0 ? <div className="mt-5"><BacktestChart data={backtest} /></div> : <p className="mt-5 text-sm text-zinc-500">No historical data available.</p>}
    </Card>
  </div>;
}
