'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Scatter } from 'recharts';
import { roomTrajectory, type RoomPoint } from '@/lib/engine/plan';
import { formatCAD } from '@/lib/format';
import { useChartColors } from '@/components/charts/theme';

export interface RoomDepletionChartProps { account: 'TFSA' | 'RRSP'; room: number; monthlyContribution: number; restorations?: { atMonth: number; amount: number }[]; currentYear?: number; }

export function RoomDepletionChart({ account, room, monthlyContribution, restorations = [], currentYear = new Date().getFullYear() }: RoomDepletionChartProps) {
  const colors = useChartColors();
  const initial = roomTrajectory(room, monthlyContribution, 60, restorations);
  const firstZero = initial.find((p) => p.month > 0 && p.remaining <= 0);
  const months = firstZero ? Math.min(60, firstZero.month + 3) : 60;
  const points = roomTrajectory(room, monthlyContribution, months, restorations).map((p) => ({ ...p, label: new Date(currentYear, new Date().getMonth() + p.month, 1).toLocaleString('en-CA', { month: 'short', year: '2-digit' }) }));
  const depletion = points.find((p) => p.month > 0 && p.remaining <= 0);
  const colour = account === 'TFSA' ? colors.TFSA : colors.RRSP;
  const depletionLabel = depletion ? new Date(currentYear, new Date().getMonth() + depletion.month, 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' }) : null;
  return <div>
    <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
      <CartesianGrid stroke={colors.grid} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.axis }} axisLine={{ stroke: colors.axis }} tickLine={false} minTickGap={24} /><YAxis tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCAD(v)} width={72} /><Tooltip formatter={(value) => formatCAD(Number(value))} labelFormatter={(label) => String(label)} /><ReferenceLine y={0} stroke={colors.axis} strokeDasharray="5 5" /><Area type="monotone" dataKey="remaining" name="Room remaining" stroke={colour} fill={colour} fillOpacity={0.16} isAnimationActive={false} />
      {depletion && <Scatter data={[depletion]} dataKey="remaining" fill={colour} isAnimationActive={false} />}
    </AreaChart></ResponsiveContainer></div>
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{depletionLabel ? <><span className="font-medium">Room runs out ~{depletionLabel}</span> <span className="text-zinc-500">({depletion?.month} months)</span></> : <>Room is not exhausted within {Math.round(months / 12)} years at the current pace.</>}</p>
  </div>;
}
