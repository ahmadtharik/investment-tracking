'use client';

import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BacktestPoint } from '@/lib/engine/backtest';
import { formatCAD } from '@/lib/format';
import { useChartColors } from '@/components/charts/theme';

export function BacktestChart({ data }: { data: BacktestPoint[] }) {
  const colors = useChartColors();
  return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 10, right: 12, left: 8, bottom: 0 }}><CartesianGrid stroke={colors.grid} vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11, fill: colors.axis }} tickFormatter={(v) => new Date(String(v)).toLocaleString('en-CA', { month: 'short', year: '2-digit' })} minTickGap={28} tickLine={false} axisLine={{ stroke: colors.axis }} /><YAxis tick={{ fontSize: 11, fill: colors.axis }} tickFormatter={(v) => formatCAD(Number(v))} width={76} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(v) => String(v)} formatter={(v, name) => [formatCAD(Number(v)), String(name)]} /><Legend wrapperStyle={{ fontSize: 12 }} /><Line type="monotone" dataKey="value" name="Portfolio value" stroke={colors.TFSA} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="invested" name="Amount invested" stroke={colors.RRSP} strokeDasharray="5 5" dot={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>;
}
