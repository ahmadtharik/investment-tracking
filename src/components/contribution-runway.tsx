'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCAD } from '@/lib/format';

type Range = 'year' | 'five-years' | 'until-pause';

export function ContributionRunway({ tfsaRoom, rrspRoom, tfsaMonthly, rrspMonthly }: { tfsaRoom: number; rrspRoom: number; tfsaMonthly: number; rrspMonthly: number }) {
  const [range, setRange] = useState<Range>('five-years');
  const { data, tfsaPause, rrspPause } = useMemo(() => {
    const start = new Date();
    const points: { label: string; tfsa: number; rrsp: number; month: number }[] = [];
    let tfsa = Math.max(0, tfsaRoom);
    let rrsp = Math.max(0, rrspRoom);
    let tfsaPause: number | null = tfsa <= 0 && tfsaMonthly > 0 ? 0 : null;
    let rrspPause: number | null = rrsp <= 0 && rrspMonthly > 0 ? 0 : null;

    for (let month = 0; month <= 120; month += 1) {
      if (month > 0) {
        const date = new Date(start.getFullYear(), start.getMonth() + month, 1);
        if (date.getMonth() === 0) tfsa += 7000;
        tfsa = Math.max(0, tfsa - Math.max(0, tfsaMonthly));
        rrsp = Math.max(0, rrsp - Math.max(0, rrspMonthly));
        if (tfsaMonthly > 0 && tfsaPause === null && tfsa <= 0) tfsaPause = month;
        if (rrspMonthly > 0 && rrspPause === null && rrsp <= 0) rrspPause = month;
      }
      const date = new Date(start.getFullYear(), start.getMonth() + month, 1);
      points.push({ month, label: date.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }), tfsa, rrsp });
    }
    return { data: points, tfsaPause, rrspPause };
  }, [rrspMonthly, rrspRoom, tfsaMonthly, tfsaRoom]);

  const firstPause = [tfsaPause, rrspPause].filter((value): value is number => value !== null).sort((a, b) => a - b)[0];
  const visibleMonths = range === 'year' ? 12 : range === 'five-years' ? 60 : Math.min(120, Math.max(12, (firstPause ?? 120) + 3));
  const visible = data.slice(0, visibleMonths + 1);
  const labelFor = (month: number | null) => month === null ? 'No pause within 10 years' : data[month]?.label ?? 'Now';
  const firstAccount = tfsaPause !== null && (rrspPause === null || tfsaPause <= rrspPause) ? 'TFSA' : rrspPause !== null ? 'RRSP' : null;

  return <section className="rounded-[14px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-[17px] font-bold text-[var(--text-primary)]">Contribution runway</h2><p className="mt-0.5 text-xs text-[var(--text-muted)]">Available registered-account room at your current monthly plan. TFSA includes a $7,000 January planning refresh.</p></div>
      <div className="inline-flex rounded-lg border border-[var(--border)] bg-white p-0.5 text-xs font-semibold">
        {[['year', '1 year'], ['five-years', '5 years'], ['until-pause', 'Until pause']].map(([value, label]) => <button key={value} type="button" onClick={() => setRange(value as Range)} className={`rounded-md px-2.5 py-1.5 ${range === value ? 'bg-blue-600 text-white' : 'text-[var(--text-muted)] hover:bg-blue-50'}`}>{label}</button>)}
      </div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <RunwayMetric account="TFSA" room={tfsaRoom} monthly={tfsaMonthly} pause={labelFor(tfsaPause)} tone="blue" />
      <RunwayMetric account="RRSP" room={rrspRoom} monthly={rrspMonthly} pause={labelFor(rrspPause)} tone="orange" />
    </div>
    <div className="mt-4 h-[225px]" role="img" aria-label="TFSA and RRSP contribution room runway">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={visible} margin={{ top: 8, right: 10, left: 4, bottom: 0 }}><CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} /><YAxis width={58} tickFormatter={(value) => value === 0 ? '$0' : `$${Math.round(Number(value) / 1000)}K`} tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value, name) => [formatCAD(Number(value)), String(name)]} /><ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="4 4" /><Line type="stepAfter" dataKey="tfsa" name="TFSA room" stroke="#2563EB" strokeWidth={2.5} dot={false} isAnimationActive={false} /><Line type="stepAfter" dataKey="rrsp" name="RRSP room" stroke="#F97316" strokeWidth={2.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
    </div>
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[var(--text-muted)]"><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />TFSA room</span><span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />RRSP room</span></div>
    <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${firstAccount ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>{firstAccount ? <><b>{firstAccount} reaches zero in {labelFor(firstAccount === 'TFSA' ? tfsaPause : rrspPause)}.</b> Pause or redirect that monthly allocation at that point.</> : <>Both registered-account allocations stay funded for at least the next 10 years at this pace.</>}</p>
  </section>;
}

function RunwayMetric({ account, room, monthly, pause, tone }: { account: 'TFSA' | 'RRSP'; room: number; monthly: number; pause: string; tone: 'blue' | 'orange' }) {
  const color = tone === 'blue' ? 'text-blue-700 bg-blue-50' : 'text-orange-700 bg-orange-50';
  return <div className={`rounded-xl p-3 ${color}`}><div className="flex items-baseline justify-between gap-3"><b className="text-sm">{account}</b><b className="text-sm tabular-nums">{formatCAD(room)}</b></div><p className="mt-1 text-xs opacity-80">{formatCAD(monthly)}/month · pause: {pause}</p></div>;
}
