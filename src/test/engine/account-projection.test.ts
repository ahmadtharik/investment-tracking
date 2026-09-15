import { describe, expect, it } from 'vitest';
import { projectAccountSeries } from '@/lib/engine/projection';

describe('account-aware projection policy', () => {
  it('adds only the configured TFSA amount at January and caps contributions', () => {
    const points = projectAccountSeries({ tfsaRoom: 1000, rrspRoom: 500, tfsaMonthly: 600, rrspMonthly: 300, tfsaAnnualRoomAddition: 7000, startMonth: 11 }, 2);
    expect(points[1].tfsaRoom).toBe(7400); // January addition, then 600 used
    expect(points[1].rrspRoom).toBe(200);
    expect(points[2].tfsaRoom).toBe(6800);
    expect(points[2].rrspRoom).toBe(0);
    expect(points[2].excessCash).toBe(100);
  });
  it('does not invent RRSP additions and routes capped amounts to excess cash', () => {
    const points = projectAccountSeries({ tfsaRoom: 0, rrspRoom: 0, tfsaMonthly: 100, rrspMonthly: 200, tfsaAnnualRoomAddition: 0 }, 2);
    expect(points[2].rrspRoom).toBe(0);
    expect(points[2].excessCash).toBe(300);
    expect(points[2].rrspContributed).toBe(0);
  });
});
