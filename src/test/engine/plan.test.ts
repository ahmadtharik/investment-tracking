import { describe, it, expect } from 'vitest';
import { computePlan, roomTrajectory } from '@/lib/engine/plan';
import type { PlanInput, InstrumentRef } from '@/lib/engine/types';

const XEQT: InstrumentRef = { id: 1, ticker: 'XEQT.TO', name: 'iShares All-Equity ETF', currency: 'CAD' };
const VTI: InstrumentRef = { id: 2, ticker: 'VTI', name: 'Vanguard Total World Stock ETF', currency: 'USD' };

function base(over: Partial<PlanInput> = {}): PlanInput {
  return {
    monthlyIncome: 5000,
    monthlyExpenses: 2250,
    emergencyFund: 10000,
    emergencyTarget: 10000,
    accountAllocation: { TFSA: 0.6, RRSP: 0.2, CASH: 0.2 },
    etfAllocation: {
      TFSA: [{ instrument: XEQT, pct: 1 }],
      RRSP: [{ instrument: VTI, pct: 1 }],
    },
    rooms: { TFSA: 9000, RRSP: 10000 },
    fx: { VTI: { provider: 'TD', rate: 1.35 } },
    ...over,
  };
}

describe('computePlan', () => {
  it('flows surplus → accounts → ETF purchases (income 5000, expenses 2250)', () => {
    const p = computePlan(base()); // surplus 2750
    expect(p.surplus).toBeCloseTo(2750);
    expect(p.savingsRate).toBeCloseTo(2750 / 5000);
    const tf = p.accounts.find((a) => a.key === 'TFSA')!;
    expect(tf.raw).toBeCloseTo(1650); // 2750 × 0.6
    expect(tf.effective).toBeCloseTo(1650);
    const rr = p.accounts.find((a) => a.key === 'RRSP')!;
    expect(rr.raw).toBeCloseTo(550);
    const cash = p.accounts.find((a) => a.key === 'CASH')!;
    expect(cash.raw).toBeCloseTo(550);
    const vti = p.purchases.find((x) => x.instrument.ticker === 'VTI')!;
    expect(vti.cadAmount).toBeCloseTo(550);
    expect(vti.nativeAmount).toBeLessThan(550 / 1.35); // FX spread eats some USD
    expect(p.fx.find((f) => f.ticker === 'VTI')!.fxCostCad).toBeGreaterThan(0);
  });

  it('caps contributions at available room', () => {
    const p = computePlan(base({ rooms: { TFSA: 500, RRSP: 10000 } }));
    const tf = p.accounts.find((a) => a.key === 'TFSA')!;
    expect(tf.effective).toBe(500);
    expect(tf.capped).toBe(true);
    expect(tf.roomUsed).toBe(500);
    const xeqt = p.purchases.find((x) => x.instrument.ticker === 'XEQT.TO')!;
    expect(xeqt.cadAmount).toBeCloseTo(500); // ETF allocation applies to the capped amount
  });

  it('flags ROOM_LOW when projected annual exceeds room', () => {
    const p = computePlan(base({ rooms: { TFSA: 5000, RRSP: 10000 } }));
    expect(p.alerts.some((a) => a.kind === 'ROOM_LOW' && a.account === 'TFSA')).toBe(true); // 1650×12 = 19800 > 5000
  });

  it('flags ROOM_NEARLY_GONE when room minus projected is < 20% of room', () => {
    const p2 = computePlan(base({ rooms: { TFSA: 20000, RRSP: 10000 } }));
    expect(p2.alerts.some((a) => a.kind === 'ROOM_NEARLY_GONE' && a.account === 'TFSA')).toBe(true);
    const p = computePlan(base({ rooms: { TFSA: 15000, RRSP: 10000 } }));
    expect(p.alerts.some((a) => a.kind === 'ROOM_LOW' && a.account === 'TFSA')).toBe(true); // 15000 < 19800
    expect(p.alerts.some((a) => a.kind === 'ROOM_NEARLY_GONE' && a.account === 'TFSA')).toBe(false);
  });

  it('flags allocation sum errors and emergency fund gap', () => {
    const p = computePlan(
      base({
        accountAllocation: { TFSA: 0.5, RRSP: 0.2, CASH: 0.2 },
        emergencyFund: 5000,
      })
    );
    expect(p.alerts.some((a) => a.kind === 'ALLOCATION_SUM' && a.where === 'account')).toBe(true);
    expect(p.alerts.some((a) => a.kind === 'EMERGENCY_BELOW_TARGET')).toBe(true);
  });

  it('flags negative surplus and contributes nothing', () => {
    const p = computePlan(base({ monthlyIncome: 1000, monthlyExpenses: 2000 }));
    expect(p.alerts.some((a) => a.kind === 'NEGATIVE_SURPLUS')).toBe(true);
    expect(p.accounts.every((a) => a.effective === 0)).toBe(true);
  });
});

describe('roomTrajectory', () => {
  it('counts room down by the monthly contribution until exhausted', () => {
    const s = roomTrajectory(50000, 2000, 30); // 50k room, 2k/mo → gone after 25 months
    expect(s[0].remaining).toBe(50000);
    expect(s[1].remaining).toBe(48000);
    const zero = s.find((p) => p.remaining <= 0);
    expect(zero!.month).toBe(25);
    expect(s[30].remaining).toBe(0); // clamped, never negative
  });

  it('adds TFSA withdrawal restorations at their month', () => {
    const s = roomTrajectory(5000, 1000, 6, [{ atMonth: 3, amount: 2000 }]);
    expect(s[2].remaining).toBe(3000);
    expect(s[3].remaining).toBe(4000); // 2000 after contribution + 2000 restored
  });
});