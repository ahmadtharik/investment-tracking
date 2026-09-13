import type { Alert } from '@/lib/engine/types';
import { formatCAD } from '@/lib/format';
import { Card } from '@/components/ui/card';

type Severity = 'critical' | 'warning';

const STYLES: Record<Severity, { wrap: string; icon: string; iconColor: string }> = {
  critical: {
    wrap: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
    icon: '✕',
    iconColor: 'text-[#d03b3b] dark:text-[#e66767]',
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    icon: '!',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
};

function describe(a: Alert): { severity: Severity; text: string } {
  switch (a.kind) {
    case 'ROOM_LOW':
      return {
        severity: 'critical',
        text: `${a.account}: only ${formatCAD(a.roomLeft)} of room left after this year's planned contributions.`,
      };
    case 'ROOM_NEARLY_GONE':
      return {
        severity: 'warning',
        text: `${a.account}: room is nearly used up — ${formatCAD(a.roomLeft)} will remain at the current pace.`,
      };
    case 'ALLOCATION_SUM':
      return {
        severity: 'critical',
        text: `Your ${a.where} allocation sums to ${Math.round(a.sum * 1000) / 10}% — it must total 100%. Fix it in Settings.`,
      };
    case 'EMERGENCY_BELOW_TARGET':
      return {
        severity: 'warning',
        text: `Emergency fund ${formatCAD(a.fund)} is below your ${formatCAD(a.target)} target.`,
      };
    case 'NEGATIVE_SURPLUS':
      return {
        severity: 'critical',
        text: `You're spending ${formatCAD(Math.abs(a.surplus))} more than you earn each month.`,
      };
  }
}

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  return (
    <Card title="Alerts">
      {alerts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No alerts — everything is on track.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alerts.map((a, i) => {
            const { severity, text } = describe(a);
            const s = STYLES[severity];
            return (
              <li
                key={i}
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${s.wrap}`}
              >
                <span aria-hidden className={`mt-0.5 font-semibold ${s.iconColor}`}>
                  {s.icon}
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">{text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}