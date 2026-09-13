'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { formatCAD, formatPct } from '@/lib/format';
import { useChartColors } from '@/components/charts/theme';

export type AllocationDatum = { key: string; name: string; value: number };

function Donut({ title, data, colors, total }: { title: string; data: AllocationDatum[]; colors: string[]; total: number }) {
  const visible = data.filter((d) => d.value > 0);
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="relative mt-2 h-48">
        {visible.length > 0 && <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={visible} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={visible.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>{visible.map((d, i) => <Cell key={d.key} fill={colors[i % colors.length]} />)}</Pie><Tooltip formatter={(v) => formatCAD(Number(v))} /></PieChart></ResponsiveContainer>}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xs text-zinc-500">Total</span><span className="text-lg font-semibold tabular-nums">{formatCAD(total)}</span></div>
      </div>
      <ul className="mt-2 space-y-1">{visible.map((d, i) => <li key={d.key} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />{d.name}</span><span className="tabular-nums">{formatCAD(d.value)} <span className="text-zinc-400">({formatPct(total ? d.value / total : 0)})</span></span></li>)}</ul>
      {visible.length === 0 && <p className="text-sm text-zinc-500">No holdings yet.</p>}
    </div>
  );
}

export function PortfolioAllocation({ byAccount, byCurrency }: { byAccount: AllocationDatum[]; byCurrency: AllocationDatum[] }) {
  const colors = useChartColors();
  const accountColors = [colors.TFSA, colors.RRSP, colors.CASH];
  const currencyColors = [colors.TFSA, colors.RRSP];
  const total = byAccount.reduce((sum, d) => sum + d.value, 0);
  return <Card title="Portfolio allocation" description="Current market value in Canadian dollars."><div className="grid gap-8 sm:grid-cols-2"><Donut title="By account" data={byAccount} colors={accountColors} total={total} /><Donut title="By currency" data={byCurrency} colors={currencyColors} total={total} /></div></Card>;
}
