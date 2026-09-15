'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { formatCAD } from '@/lib/format';

export type AllocationSegment = { label: string; pct: number; amount: number; color: string };

function SegmentTooltip({ children, label, pct, amount }: { children: React.ReactElement; label: string; pct: number; amount: number }) {
  return <Tooltip.Root><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content side="top" sideOffset={6} className="z-50 rounded-md bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg" role="tooltip"><span className="font-medium">{label}</span>: {pct.toFixed(1)}% · {formatCAD(amount)} monthly<Tooltip.Arrow className="fill-zinc-900" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}

export function AllocationBar({ segments, total, title = 'Allocation' }: { segments: AllocationSegment[]; total: number; title?: string }) {
  const valid = Math.abs(total - 100) < 0.1;
  const remainder = Math.max(0, 100 - total);
  return <Tooltip.Provider delayDuration={150}><div className="mt-4" aria-label={`${title}: ${total.toFixed(1)}% allocated`}>
    <div className={`flex h-4 w-full overflow-hidden rounded-full bg-zinc-100 ${!valid && total > 100 ? 'ring-2 ring-red-400' : ''}`} role="img" aria-label={`${title} segmented allocation`}>
      {segments.filter((s) => s.pct > 0).map((s) => <SegmentTooltip key={s.label} label={s.label} pct={s.pct} amount={s.amount}><span tabIndex={0} aria-label={`${s.label}, ${s.pct.toFixed(1)} percent, ${formatCAD(s.amount)} monthly`} className="h-full outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900" style={{ width: `${Math.min(100, Math.max(0, s.pct))}%`, backgroundColor: s.color }} /></SegmentTooltip>)}
      {remainder > 0 && <SegmentTooltip label="Unallocated" pct={remainder} amount={0}><span tabIndex={0} aria-label={`Unallocated, ${remainder.toFixed(1)} percent`} className="h-full bg-zinc-200 outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900" style={{ width: `${remainder}%` }} /></SegmentTooltip>}
    </div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">{segments.map((s) => <span key={s.label}><span className="font-medium">{s.label}</span>: {s.pct.toFixed(1)}% ({formatCAD(s.amount)}/mo)</span>)}{remainder > 0 && <span>Unallocated: {remainder.toFixed(1)}%</span>}</div>
    {!valid && <p className="mt-1 text-xs font-medium text-red-600">{total > 100 ? 'Allocation is over 100%; this is not a valid plan.' : 'Allocation has an unallocated remainder.'}</p>}
  </div></Tooltip.Provider>;
}
