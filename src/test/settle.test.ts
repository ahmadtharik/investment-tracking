import { describe, expect, it, vi } from 'vitest';

const getHistory = vi.hoisted(() => vi.fn(async () => [{ date: '2026-01-01', close: 50 }, { date: '2026-02-01', close: 52 }]));
vi.mock('@/lib/market/yahoo', () => ({ getHistory, getQuotes: vi.fn(async () => ({})) }));

import { pricedLines } from '@/lib/schedule/settle';

describe('pricedLines', () => {
  it('fetches history once per ticker across a catch-up', async () => {
    const lines = [{ account: 'TFSA' as const, instrumentId: 1, ticker: 'XEQT.TO', currency: 'CAD' as const, amountCad: 500 }];
    const history = new Map();
    const january = await pricedLines(lines, '2026-01-15', '2026-11-11', history);
    const february = await pricedLines(lines, '2026-02-15', '2026-11-11', history);
    expect(getHistory).toHaveBeenCalledTimes(1);
    expect(january[0]).toMatchObject({ price_native: 50, units: 10 });
    expect(february[0]).toMatchObject({ price_native: 52 });
  });
});
