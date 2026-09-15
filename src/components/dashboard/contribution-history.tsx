'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCAD } from '@/lib/format';
import { useChartColors } from '@/components/charts/theme';

export interface HistoryDatum {
  label: string;
  TFSA: number;
  RRSP: number;
  CASH: number;
}

export function ContributionHistory({ data }: { data: HistoryDatum[] }) {
  const colors = useChartColors();
  const hasContributions = data.some((row) => row.TFSA > 0 || row.RRSP > 0 || row.CASH > 0);
  return (
    <div>
      {!hasContributions && <p className="mb-3 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">No actual deposits logged yet. Use Accounts → Log an actual contribution to start this history.</p>}
      <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.axis }} axisLine={{ stroke: colors.axis }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: colors.axis }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatCAD(v)}
            width={72}
          />
          <Tooltip
            formatter={(value, name) => [formatCAD(Number(value)), String(name)]}
            cursor={{ fill: 'rgba(113, 113, 122, 0.08)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="TFSA" stackId="invest" fill={colors.TFSA} isAnimationActive={false} />
          <Bar dataKey="RRSP" stackId="invest" fill={colors.RRSP} isAnimationActive={false} />
          <Bar dataKey="CASH" stackId="invest" fill={colors.CASH} radius={[2, 2, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
