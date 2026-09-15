import { Card } from '@/components/ui/card';

const rules = [
  ['TFSA is a tax-free shelter, not an investment.', 'Choose investments inside the account; the account itself does not create returns.'],
  ['Total return includes price appreciation and reinvested dividends, do not double-count.', 'Use one total-return figure when comparing strategies.'],
  ['XEQT is global equity in one fund.', 'Its broad diversification makes it a simple core holding.'],
  ['VTI is a deliberate US tilt.', 'Use it when you intentionally want more US exposure, not as an accidental duplicate.'],
  ['Avoid overlap.', 'XEQT already holds US large-cap stocks, so adding VTI increases that exposure.'],
  ['Keep the emergency fund liquid and separate.', 'Do not invest money that may be needed for an unexpected expense.'],
  ['Near-term money (1–3 years) belongs in cash or GICs.', 'A short timeline is too brief to rely on equity-market recovery.'],
  ['Review TFSA and RRSP room every January.', 'Fresh room and prior-year activity can change the amount you can contribute safely.'],
  ['Contribution-room rules differ per account.', 'Track TFSA and RRSP limits separately and use the correct account for each goal.'],
] as const;

export default function RulesPage() {
  return <div className="mx-auto max-w-3xl px-4 py-8">
    <h1 className="text-2xl font-semibold tracking-tight">Strategy &amp; Rules</h1>
    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">A compact reference for the assumptions behind your investment plan.</p>
    <Card className="mt-6">
      <ol className="space-y-5">
        {rules.map(([rule, why], index) => <li key={rule} className="flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{index + 1}</span>
          <div><h2 className="font-medium">{rule}</h2><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{why}</p></div>
        </li>)}
      </ol>
    </Card>
  </div>;
}
