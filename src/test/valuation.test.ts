import { describe, expect, it } from 'vitest';
import { canSaveSnapshot, gainCad, holdingValueCad, valuationTickers } from '@/lib/valuation';

const holding = { ticker: 'VTI', units: 2, balance_native: 50, currency: 'USD', fx_rate: 1.3 };

describe('holdingValueCad', () => {
  it('uses the live price and live FX rate', () => {
    expect(holdingValueCad(holding, { VTI: { price: 100 }, 'CAD=X': { price: 1.4 } })).toBeCloseTo(280);
  });
  it('falls back to the saved FX rate', () => {
    expect(holdingValueCad(holding, { VTI: { price: 100 } })).toBeCloseTo(260);
  });
  it('uses the recorded balance when units are zero, even with a quote', () => {
    expect(holdingValueCad({ ...holding, units: 0, currency: 'CAD' }, { VTI: { price: 100 } })).toBe(50);
  });
});

describe('gainCad', () => {
  const cad = { ticker: 'A', units: 2, balance_native: 0, currency: 'CAD', fx_rate: 1 };
  it('compares value with cost', () => {
    expect(gainCad([{ ...cad, cost_cad: 150 }], { A: { price: 100 } })).toEqual({ gain: 50, cost: 150 });
  });
  it('is unknown when any cost is missing', () => {
    expect(gainCad([{ ...cad, cost_cad: 150 }, { ...cad, cost_cad: null }], { A: { price: 100 } })).toBeNull();
  });
});

describe('valuationTickers', () => {
  it('adds the FX rate only for USD holdings', () => {
    expect(valuationTickers([{ ticker: 'XEQT.TO', currency: 'CAD' }])).toEqual(['XEQT.TO']);
    expect(valuationTickers([{ ticker: 'VTI', currency: 'USD' }])).toEqual(['VTI', 'CAD=X']);
  });
});

describe('canSaveSnapshot', () => {
  const now = Date.parse('2026-11-11T18:00:00Z');
  const fresh = new Date(now - 60_000).toISOString();
  const old = new Date(now - 2 * 86_400_000).toISOString();
  it('saves when every priced holding and the FX rate are fresh', () => {
    expect(canSaveSnapshot([holding], { VTI: { asOf: fresh }, 'CAD=X': { asOf: fresh } }, now)).toBe(true);
  });
  it('skips when a quote is missing, so saved balances never stand in for prices', () => {
    expect(canSaveSnapshot([holding], { 'CAD=X': { asOf: fresh } }, now)).toBe(false);
  });
  it('skips when a quote is old', () => {
    expect(canSaveSnapshot([holding], { VTI: { asOf: old }, 'CAD=X': { asOf: fresh } }, now)).toBe(false);
  });
  it('needs no quote for a holding tracked only by balance', () => {
    expect(canSaveSnapshot([{ ...holding, units: 0, currency: 'CAD' }], {}, now)).toBe(true);
  });
});
