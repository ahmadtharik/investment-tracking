import { describe, expect, it } from 'vitest';
import { futureValue, projectSeries } from '@/lib/engine/projection';

describe('projection engine', () => {
  it('matches the monthly annuity formula', () => {
    const r = 0.07 / 12, months = 120;
    const expected = 10000 * (1 + r) ** months + 2000 * (((1 + r) ** months - 1) / r);
    expect(futureValue({ starting: 10000, monthlyContribution: 2000, annualReturn: 0.07 }, 10).value).toBeCloseTo(expected, 4);
  });
  it('handles zero return and includes starting in contributions', () => {
    const output = futureValue({ starting: 1000, monthlyContribution: 100, annualReturn: 0 }, 5);
    expect(output.contributed).toBe(7000);
    expect(output.value).toBe(output.contributed);
  });
  it('starts at month zero and matches the horizon value', () => {
    const input = { starting: 1000, monthlyContribution: 100, annualReturn: 0.07 };
    const series = projectSeries(input, 12);
    expect(series[0].value).toBe(1000);
    expect(series[11].value).toBeCloseTo(futureValue(input, 1 - 1 / 12).value, 6);
    expect(series).toHaveLength(13);
  });
});
