import { describe, expect, it } from 'vitest';
import { runBacktest } from '@/lib/engine/backtest';

const points = Array.from({ length: 13 }, (_, i) => ({ date: `2024-${String(i + 1).padStart(2, '0')}-01`, close: 100 + i }));

describe('backtest engine', () => {
  it('buys monthly and values at each month close', () => {
    const output = runBacktest({ monthlyAmount: 1000, points });
    expect(output).toHaveLength(13);
    expect(output[1].units).toBeCloseTo(1000 / 100 + 1000 / 101);
    expect(output[12].value).toBeCloseTo(output[12].units * 112, 4);
    expect(output[12].invested).toBe(13000);
  });
  it('returns one point per supplied price', () => expect(runBacktest({ monthlyAmount: 500, points: points.slice(0, 4) })).toHaveLength(4));
});
