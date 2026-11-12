import { describe, expect, it } from 'vitest';
import { buildInstalment, coversNextByDefault, dueAfter, dueDateIn, firstDueOnOrAfter, nextDueForNewDay, nextDueFrom, todayInToronto } from '@/lib/engine/schedule';
import type { PlanInput } from '@/lib/engine/types';

const instrument = (id: number, ticker: string, currency: 'CAD' | 'USD' = 'CAD') => ({ id, ticker, name: ticker, currency });
const base: PlanInput = {
  monthlyIncome: 5000, monthlyExpenses: 4000, emergencyFund: 0, emergencyTarget: 0,
  accountAllocation: { TFSA: 0.6, RRSP: 0.3, CASH: 0.1 },
  etfAllocation: { TFSA: [{ instrument: instrument(1, 'XEQT.TO'), pct: 1 }], RRSP: [] },
  rooms: { TFSA: 0, RRSP: 0 }, fx: {},
};

describe('due dates', () => {
  it('uses the last day of a short month', () => {
    expect(dueDateIn(2027, 1, 31)).toBe('2027-02-28');
    expect(dueAfter('2027-01-31', 31)).toBe('2027-02-28');
    expect(dueAfter('2027-02-28', 31)).toBe('2027-03-31');
  });
  it('rolls over the year', () => {
    expect(dueAfter('2026-12-15', 15)).toBe('2027-01-15');
  });
  it('starts from today without creating a backlog', () => {
    expect(firstDueOnOrAfter('2026-11-01', 1)).toBe('2026-11-01');
    expect(firstDueOnOrAfter('2026-11-02', 1)).toBe('2026-12-01');
    expect(firstDueOnOrAfter('2026-12-20', 15)).toBe('2027-01-15');
  });
  it('never reuses a handled month', () => {
    expect(nextDueFrom('2026-11-01', 1, '2026-11-01')).toBe('2026-12-01');
    expect(nextDueFrom('2026-11-05', 20, '2026-11-15')).toBe('2026-12-20');
    expect(nextDueFrom('2026-11-05', 20, '2026-10-15')).toBe('2026-11-20');
    expect(nextDueFrom('2026-11-05', 20)).toBe('2026-11-20');
  });
  it('reads today in Toronto, not UTC', () => {
    expect(todayInToronto(new Date('2026-11-02T02:00:00Z'))).toBe('2026-11-01');
  });
});

describe('buildInstalment', () => {
  it('follows the plan percentages by stock and account', () => {
    expect(buildInstalment(base).map((l) => [l.account, l.ticker, l.amountCad])).toEqual([['TFSA', 'XEQT.TO', 600], ['RRSP', null, 300], ['CASH', null, 100]]);
  });
  it('keeps split amounts summing to the account amount', () => {
    const third = { TFSA: [1, 2, 3].map((id) => ({ instrument: instrument(id, `T${id}`), pct: 1 / 3 })), RRSP: [] };
    const lines = buildInstalment({ ...base, monthlyIncome: 4100, monthlyExpenses: 4000, accountAllocation: { TFSA: 1 }, etfAllocation: third });
    expect(lines.reduce((sum, l) => sum + l.amountCad, 0)).toBeCloseTo(100, 2);
  });
  it('produces nothing without a surplus', () => {
    expect(buildInstalment({ ...base, monthlyExpenses: 6000 })).toEqual([]);
  });
});

describe('coversNextByDefault', () => {
  it('treats a purchase in the due month or the week before as the instalment', () => {
    expect(coversNextByDefault('2026-11-03', '2026-11-15')).toBe(true);
    expect(coversNextByDefault('2026-10-28', '2026-11-01')).toBe(true);
  });
  it('treats an earlier purchase as an extra', () => {
    expect(coversNextByDefault('2026-10-05', '2026-11-15')).toBe(false);
  });
});

describe('nextDueForNewDay', () => {
  it("keeps this month's open instalment when moving to a day that has passed", () => {
    expect(nextDueForNewDay('2026-11-11', 5, '2026-11-15', '2026-10-15')).toBe('2026-11-15');
  });
  it('moves to a later day in the same month', () => {
    expect(nextDueForNewDay('2026-11-11', 20, '2026-11-15', '2026-10-15')).toBe('2026-11-20');
  });
  it('uses the new day once this month is already handled', () => {
    expect(nextDueForNewDay('2026-11-20', 5, '2026-12-15', '2026-11-15')).toBe('2026-12-05');
  });
});
