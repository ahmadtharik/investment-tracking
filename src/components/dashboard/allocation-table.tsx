import type { PlanResult } from '@/lib/engine/types';
import { formatCAD } from '@/lib/format';
import { Card } from '@/components/ui/card';

const NAMES: Record<string, string> = { TFSA: 'TFSA', RRSP: 'RRSP', CASH: 'Cash' };

export function AllocationTable({ plan }: { plan: PlanResult }) {
  return (
    <Card
      title="Recommended monthly allocation"
      description="Your surplus split across accounts. When contribution room runs low, the purchase is capped."
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="pb-2 font-medium">Account</th>
            <th className="pb-2 text-right font-medium">Planned</th>
            <th className="pb-2 text-right font-medium">Invested this month</th>
            <th className="pb-2 pl-4 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {plan.accounts.map((a) => (
            <tr key={a.key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
              <td className="py-2 font-medium">{NAMES[a.key]}</td>
              <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{formatCAD(a.raw)}</td>
              <td className="py-2 text-right tabular-nums font-medium">{formatCAD(a.effective)}</td>
              <td className="py-2 pl-4">
                {a.capped ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
                    Capped by room
                  </span>
                ) : a.key === 'CASH' ? (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">Kept as cash</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}