import { formatCAD, formatPct } from '@/lib/format';

export function OverviewCards({
  income,
  expenses,
  surplus,
  savingsRate,
}: {
  income: number;
  expenses: number;
  surplus: number;
  savingsRate: number;
}) {
  const tiles = [
    { label: 'Monthly income', value: formatCAD(income), negative: false },
    { label: 'Monthly expenses', value: formatCAD(expenses), negative: false },
    { label: 'Monthly surplus', value: formatCAD(surplus), negative: surplus < 0 },
    { label: 'Savings rate', value: formatPct(savingsRate), negative: surplus < 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t.label}</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              t.negative ? 'text-red-600 dark:text-red-400' : ''
            }`}
          >
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}