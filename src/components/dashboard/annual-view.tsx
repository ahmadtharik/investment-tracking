import { formatCAD } from '@/lib/format';
import { Card } from '@/components/ui/card';

export function AnnualView({
  investedThisYear,
  projectedAnnual,
  roomAfter,
  restorations,
}: {
  investedThisYear: number;
  projectedAnnual: { TFSA: number; RRSP: number };
  roomAfter: { TFSA: number; RRSP: number };
  restorations: number;
}) {
  const rows = [
    { label: 'TFSA', planned: projectedAnnual.TFSA, left: roomAfter.TFSA },
    { label: 'RRSP', planned: projectedAnnual.RRSP, left: roomAfter.RRSP },
  ];
  return (
    <Card
      title="Annual view"
      description="What you've invested so far this year vs. the pace of your plan, and the room left by year-end."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Invested this year
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatCAD(investedThisYear)}</p>
        </div>
        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {r.label}, projected annual / room left
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCAD(r.planned)}
              <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
                {' '}
                / {formatCAD(Math.max(r.left, 0))}
              </span>
            </p>
          </div>
        ))}
      </div>
      {restorations > 0 && (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Includes {formatCAD(restorations)} of TFSA room restoring from withdrawals taken last year.
        </p>
      )}
    </Card>
  );
}
