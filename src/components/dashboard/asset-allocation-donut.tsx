'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCAD, formatPct } from '@/lib/format';

export interface AssetAllocationDatum { key: string; name: string; value: number; color: string }

export function AssetAllocationDonut({ data }: { data: AssetAllocationDatum[] }) {
  const visible = data.filter((datum) => datum.value > 0);
  const total = visible.reduce((sum, datum) => sum + datum.value, 0);
  return <div>{!visible.length ? <p className="rounded-lg bg-[var(--surface-page)] px-3 py-8 text-center text-sm text-[var(--text-muted)]">Add holdings to see your allocation.</p> : <><div className="relative mx-auto h-52 w-full max-w-[232px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={visible} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="66%" outerRadius="94%" paddingAngle={visible.length > 1 ? 2 : 0} stroke="white" strokeWidth={2} isAnimationActive={false}>{visible.map((datum) => <Cell key={datum.key} fill={datum.color} />)}</Pie><Tooltip formatter={(value) => formatCAD(Number(value))} contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgb(15 23 42 / 12%)' }} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="mt-0.5 text-lg font-bold tabular-nums text-[var(--text-primary)]">{formatCAD(total)}</span><span className="text-[11px] text-[var(--text-muted)]">Total</span></div></div><ul className="mt-2 space-y-2">{visible.map((datum) => <li key={datum.key} className="grid grid-cols-[10px_minmax(0,1fr)_42px_72px] items-center gap-2 text-xs"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: datum.color }} /><span className="min-w-0 truncate font-medium text-[var(--text-body)]">{datum.name}</span><span className="tabular-nums text-[var(--text-muted)]">{formatPct(datum.value / total)}</span><span className="text-right font-semibold tabular-nums text-[var(--text-primary)]">{formatCAD(datum.value)}</span></li>)}</ul></>}</div>;
}
