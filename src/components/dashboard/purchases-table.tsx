import type { PlanResult } from '@/lib/engine/types';
import { formatCAD, formatUSD } from '@/lib/format';
import { Card } from '@/components/ui/card';

const NAMES: Record<string, string> = { TFSA: 'TFSA', RRSP: 'RRSP', CASH: 'Cash' };

export function PurchasesTable({
  plan,
  quotes,
}: {
  plan: PlanResult;
  quotes: Record<string, { price: number; currency: string }>;
}) {
  if (plan.purchases.length === 0) {
    return (
      <Card title="Investment breakdown">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nothing to buy this month. Set an account allocation and ETF choices in Settings.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Investment breakdown" description="What each month's purchase looks like, including FX cost for USD ETFs.">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="pb-2 font-medium">Account</th>
            <th className="pb-2 font-medium">Instrument</th>
            <th className="pb-2 text-right font-medium">CAD amount</th>
            <th className="pb-2 text-right font-medium">Native amount</th>
            <th className="pb-2 text-right font-medium">FX cost</th>
            <th className="pb-2 text-right font-medium">Latest price</th>
          </tr>
        </thead>
        <tbody>
          {plan.purchases.map((p, i) => {
            const isUsd = p.instrument.currency === 'USD';
            const fxEntry = plan.fx.find(
              (f) => f.ticker === p.instrument.ticker && Math.abs(f.cadAmount - p.cadAmount) < 1e-9
            );
            const quote = quotes[p.instrument.ticker];
            return (
              <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="py-2 font-medium">{NAMES[p.account]}</td>
                <td className="py-2">
                  <span className="font-medium">{p.instrument.ticker}</span>{' '}
                  <span className="text-zinc-500 dark:text-zinc-400">{p.instrument.name}</span>
                </td>
                <td className="py-2 text-right tabular-nums">{formatCAD(p.cadAmount)}</td>
                <td className="py-2 text-right tabular-nums">
                  {isUsd ? formatUSD(p.nativeAmount) : formatCAD(p.nativeAmount)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {fxEntry ? (
                    <span title={`Provider: ${fxEntry.provider}`}>{formatCAD(fxEntry.fxCostCad)}</span>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">n/a</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                  {quote ? (
                    quote.currency === 'USD' ? formatUSD(quote.price) : formatCAD(quote.price)
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">n/a</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
