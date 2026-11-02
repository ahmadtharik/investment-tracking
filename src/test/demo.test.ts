import { afterEach, describe, expect, it } from 'vitest';
import { buildDemoData, isDemoUser } from '@/lib/demo/seed';

const data = buildDemoData('2026-11-20', { equity: 1, usd: 4 });

describe('buildDemoData', () => {
  it('keeps the next instalment in the future and history in the past', () => {
    expect(data.schedule.next_due).toBe('2026-12-15');
    expect(data.cycles.every((cycle) => cycle.due_on < '2026-11-20')).toBe(true);
    expect(data.cycles.map((cycle) => cycle.due_on)).toContain('2026-11-15');
  });
  it('gives each instalment one cycle and matching contributions', () => {
    expect(new Set(data.cycles.map((cycle) => cycle.due_on)).size).toBe(data.cycles.length);
    expect(data.contributions).toHaveLength(data.cycles.length * 3);
  });
  it('allocates exactly 100%', () => {
    expect(data.accountAlloc.reduce((sum, row) => sum + row.pct, 0)).toBeCloseTo(1);
  });
  it('holds each stock once per account', () => {
    expect(new Set(data.holdings.map((row) => `${row.account}${row.instrument_id}`)).size).toBe(data.holdings.length);
  });
  it('ends the value history today, one value per day', () => {
    expect(data.snapshots.at(-1)?.snapshot_on).toBe('2026-11-20');
    expect(new Set(data.snapshots.map((row) => row.snapshot_on)).size).toBe(90);
  });
});

describe('isDemoUser', () => {
  const original = process.env.DEMO_USER_ID;
  afterEach(() => { process.env.DEMO_USER_ID = original; });
  it('matches only the configured account', () => {
    process.env.DEMO_USER_ID = 'demo';
    expect(isDemoUser('demo')).toBe(true);
    expect(isDemoUser('someone')).toBe(false);
  });
  it('treats everyone as a normal user when unset', () => {
    delete process.env.DEMO_USER_ID;
    expect(isDemoUser('demo')).toBe(false);
    expect(isDemoUser(undefined)).toBe(false);
  });
});
