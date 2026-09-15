import type { ContributionFrequency } from './projection';
export interface BacktestInput { monthlyAmount: number; points: { date: string; close: number }[]; contributionFrequency?: ContributionFrequency }
export interface BacktestPoint { date: string; value: number; invested: number; units: number }

export function runBacktest({ monthlyAmount, points, contributionFrequency = 'monthly' }: BacktestInput): BacktestPoint[] {
  let units = 0;
  let invested = 0;
  const periods = { weekly: 52, biweekly: 26, monthly: 12, yearly: 1 }[contributionFrequency];
  const monthlyEquivalent = monthlyAmount * periods / 12;
  return points.map((point, index) => {
    const contribution = contributionFrequency === 'yearly' ? (index > 0 && index % 12 === 0 ? monthlyAmount : index === 0 ? monthlyAmount : 0) : monthlyEquivalent;
    if (contribution > 0 && point.close > 0 && Number.isFinite(point.close)) units += contribution / point.close;
    invested += contribution;
    return { date: point.date, value: units * point.close, invested, units };
  });
}
