'use client';

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProjectionPoint } from '@/lib/engine/projection';
import { formatCAD } from '@/lib/format';
import { useChartColors } from '@/components/charts/theme';

export function ProjectionChart({ data }: { data: ProjectionPoint[] }) {
  const colors = useChartColors();
  const ticks = data.filter((point) => point.month % 60 === 0).map((point) => point.month);
  return <div className="h-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}><CartesianGrid stroke={colors.grid} vertical={false} /><XAxis dataKey="month" ticks={ticks} tick={{ fontSize: 11, fill: colors.axis }} tickFormatter={(v) => `${Number(v) / 12}y`} tickLine={false} axisLine={{ stroke: colors.axis }} /><YAxis tick={{ fontSize: 11, fill: colors.axis }} tickFormatter={(v) => formatCAD(Number(v))} width={62} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(v) => `Month ${v}`} formatter={(v, name) => [formatCAD(Number(v)), String(name)]} /><Area type="monotone" dataKey="value" name="Portfolio value" fill={colors.TFSA} fillOpacity={0.18} stroke={colors.TFSA} isAnimationActive={false} /><Line type="monotone" dataKey="contributed" name="Contributed" stroke={colors.TFSA} strokeDasharray="5 4" dot={false} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>;
}
