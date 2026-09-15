'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Scatter } from 'recharts';
import { roomTrajectory, type RoomPoint } from '@/lib/engine/plan';
import { formatCAD } from '@/lib/format';
import { useChartColors } from '@/components/charts/theme';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

export interface RoomDepletionChartProps { account: 'TFSA' | 'RRSP'; room: number; monthlyContribution: number; annualPlanned?: number; restorations?: { atMonth: number; amount: number }[]; annualRoomAddition?: number; currentYear?: number; }

export function RoomDepletionChart({ account, room, monthlyContribution, annualPlanned = monthlyContribution * 12, restorations = [], annualRoomAddition = 0, currentYear = new Date().getFullYear() }: RoomDepletionChartProps) {
  const colors = useChartColors();
  const [additionValue, setAdditionValue] = useState(String(annualRoomAddition));
  const addition = Number(additionValue) || 0;
  const janAdditions = addition > 0 ? Array.from({ length: 6 }, (_, i) => ({ atMonth: (i + 1) * 12 - new Date().getMonth(), amount: addition })).filter((r) => r.atMonth > 0 && r.atMonth <= 60) : [];
  const allRestorations = [...restorations, ...janAdditions];
  const initial = roomTrajectory(room, monthlyContribution, 60, allRestorations);
  const firstZero = initial.find((p) => p.month > 0 && p.remaining <= 0);
  const months = firstZero ? Math.min(60, firstZero.month + 3) : 60;
  const points = roomTrajectory(room, monthlyContribution, months, allRestorations).map((p) => ({ ...p, label: new Date(currentYear, new Date().getMonth() + p.month, 1).toLocaleString('en-CA', { month: 'short', year: '2-digit' }) }));
  const depletion = points.find((p) => p.month > 0 && p.remaining <= 0);
  const colour = account === 'TFSA' ? colors.TFSA : colors.RRSP;
  const depletionLabel = depletion ? new Date(currentYear, new Date().getMonth() + depletion.month, 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' }) : null;
  return <div>
    <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
      <CartesianGrid stroke={colors.grid} vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: colors.axis }} axisLine={{ stroke: colors.axis }} tickLine={false} minTickGap={24} /><YAxis tick={{ fontSize: 11, fill: colors.axis }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCAD(v)} width={72} /><Tooltip formatter={(value) => formatCAD(Number(value))} labelFormatter={(label) => String(label)} /><ReferenceLine y={0} stroke={colors.axis} strokeDasharray="5 5" /><Area type="monotone" dataKey="remaining" name="Room remaining" stroke={colour} fill={colour} fillOpacity={0.16} isAnimationActive={false} />
      {depletion && <Scatter data={[depletion]} dataKey="remaining" fill={colour} isAnimationActive={false} />}
    </AreaChart></ResponsiveContainer></div>
    <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"><p><span className="font-medium">Available now:</span> {formatCAD(room)}. Monthly pace is {formatCAD(monthlyContribution)}, or {formatCAD(annualPlanned)} planned annually.</p><p className="mt-1">{depletionLabel ? <><span className="font-medium">Expected depletion:</span> {depletionLabel} ({depletion?.month} months).</> : <>Room is not exhausted within {Math.round(months / 12)} years at this pace.</>}{addition > 0 && <span> TFSA forecast includes {formatCAD(addition)} added each January as a planning assumption.</span>}</p>{annualRoomAddition > 0 && <label className="mt-2 flex items-center gap-2 text-xs">Annual TFSA addition assumption <Input type="number" min={0} step={100} value={additionValue} onChange={(e) => setAdditionValue(e.target.value)} className="w-28 py-1" /> CAD</label>}{restorations.length > 0 && <p className="mt-1">Forecast includes {formatCAD(restorations.reduce((sum, r) => sum + r.amount, 0))} in scheduled restoration(s).</p>}</div>
  </div>;
}
