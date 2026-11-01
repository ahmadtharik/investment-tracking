import { describe, expect, it } from 'vitest';
import { gainCad, holdingValueCad, valuationTickers } from '@/lib/valuation';

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
