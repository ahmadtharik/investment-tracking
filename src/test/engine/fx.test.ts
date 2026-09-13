import { describe, it, expect } from 'vitest';
import { convertCadToUsd, annualFxCost, FX_SPREADS } from '@/lib/engine/fx';

describe('convertCadToUsd', () => {
  it('applies the provider spread to the mid-rate conversion', () => {
    const r = convertCadToUsd(1000, 1.35, { provider: 'CUSTOM', rate: 1.35 }); // spread 0
    expect(r.usdReceived).toBeCloseTo(1000 / 1.35, 6);
    expect(r.fxCostCad).toBeCloseTo(0, 6);
  });

  it('charges the TD spread', () => {
    const r = convertCadToUsd(1000, 1.35, { provider: 'TD', rate: 1.35 });
    const expectedUsd = (1000 / 1.35) * (1 - FX_SPREADS.TD);
    expect(r.usdReceived).toBeCloseTo(expectedUsd, 6);
    expect(r.fxCostCad).toBeCloseTo(1000 - expectedUsd * 1.35, 6); // cost expressed in CAD
  });

  it('handles zero amount', () => {
    expect(convertCadToUsd(0, 1.35, { provider: 'WEALTHSIMPLE', rate: 1.35 }).usdReceived).toBe(0);
  });

  it('falls back to the mid rate when the config rate is unusable', () => {
    const r = convertCadToUsd(100, 1.35, { provider: 'CUSTOM', rate: 0 });
    expect(r.usdReceived).toBeCloseTo(100 / 1.35, 6);
  });
});

describe('annualFxCost', () => {
  it('scales monthly cost ×12 and reports annual USD received', () => {
    const r = annualFxCost(500, 1.35, { provider: 'TD', rate: 1.35 });
    expect(r.annualCost).toBeCloseTo(r.monthlyCost * 12, 6);
    expect(r.annualUsdReceived).toBeCloseTo((500 / 1.35) * (1 - FX_SPREADS.TD) * 12, 6);
  });
});