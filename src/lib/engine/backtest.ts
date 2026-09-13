export interface BacktestInput { monthlyAmount: number; points: { date: string; close: number }[] }
export interface BacktestPoint { date: string; value: number; invested: number; units: number }

export function runBacktest({ monthlyAmount, points }: BacktestInput): BacktestPoint[] {
  let units = 0;
  let invested = 0;
  return points.map((point) => {
    if (point.close > 0 && Number.isFinite(point.close)) units += monthlyAmount / point.close;
    invested += monthlyAmount;
    return { date: point.date, value: units * point.close, invested, units };
  });
}
