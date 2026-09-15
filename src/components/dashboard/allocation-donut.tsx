'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCAD } from '@/lib/format';
import { useChartColors } from '@/components/charts/theme';

export interface DonutDatum {
  key: 'TFSA' | 'RRSP' | 'CASH';
  name: string;
  value: number;
}

export function AllocationDonut({ data }: { data: DonutDatum[] }) {
  const colors = useChartColors();
  const visible = data.filter((d) => d.value > 0);
  const total = visible.reduce((t, d) => t + d.value, 0);

  return (
    <div>
      <div className="relative h-56">
        {visible.length > 0 && (
          <ResponsiveContainer className="relative z-10" width="100%" height="100%">
            <PieChart>
              <Pie
                data={visible}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="64%"
                outerRadius="90%"
                paddingAngle={visible.length > 1 ? 2 : 0}
                stroke="none"
                isAnimationActive={false}
              >
                {visible.map((d) => (
                  <Cell key={d.key} fill={colors[d.key]} />
                ))}
              </Pie>
              <Tooltip wrapperStyle={{ zIndex: 50 }} contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(53,48,36,0.16)', color: 'var(--ink)' }} formatter={(value) => formatCAD(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
          <span className="text-xs text-[var(--muted)]">Monthly surplus</span>
          <span className="text-xl font-semibold tabular-nums text-[var(--ink)]">{formatCAD(total)}</span>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          No surplus to allocate yet. Set income and expenses in Settings.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1">
          {visible.map((d) => (
            <li key={d.key} className="flex items-center gap-1.5 text-sm">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: colors[d.key] }}
              />
              <span className="text-zinc-600 dark:text-zinc-300">{d.name}</span>
              <span className="font-medium tabular-nums">{formatCAD(d.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
