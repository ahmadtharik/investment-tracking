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
        <div key={t.label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_6px_22px_rgba(53,48,36,0.035)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{t.label}</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              t.negative ? 'text-red-700' : 'text-[var(--ink)]'
            }`}
          >
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}
