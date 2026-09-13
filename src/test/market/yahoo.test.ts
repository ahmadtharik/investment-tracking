import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockServiceSupabase = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({
  serviceSupabase: () => mockServiceSupabase(),
}));

const mockYahoo = vi.hoisted(() => ({ quote: vi.fn(), historical: vi.fn(), search: vi.fn() }));
vi.mock('yahoo-finance2', () => ({ default: mockYahoo }));

import { getQuotes, getHistory, searchInstruments } from '@/lib/market/yahoo';

/** Minimal in-memory stand-in for the Supabase client (from/select/in/eq/gte/upsert). */
class FakeQuery {
  private rows: any[];
  constructor(rows: any[]) {
    this.rows = rows;
  }
  select() {
    return this;
  }
  in(_col: string, vals: string[]) {
    this.rows = this.rows.filter((r) => vals.includes(r.ticker));
    return this;
  }
  eq(_col: string, v: string) {
    this.rows = this.rows.filter((r) => r.ticker === v);
    return this;
  }
  gte(_col: string, v: string) {
    this.rows = this.rows.filter((r) => r.price_date >= v);
    return this;
  }
  async upsert(newRows: any | any[]) {
    const rows = Array.isArray(newRows) ? newRows : [newRows];
    for (const row of rows) {
      const i = this.rows.findIndex((r) => r.ticker === row.ticker && r.price_date === row.price_date);
      if (i >= 0) this.rows[i] = { ...this.rows[i], ...row };
      else this.rows.push(row);
    }
    return { data: rows, error: null };
  }
  async execute() {
    return { data: this.rows, error: null };
  }
  // Thenable: awaiting the query chain resolves to { data, error }, like the real client.
  then(onFulfilled?: (v: { data: any[]; error: null }) => any, onRejected?: (e: any) => any) {
    return Promise.resolve({ data: this.rows, error: null }).then(onFulfilled, onRejected);
  }
}

class FakeSupabase {
  tables: Record<string, any[]> = {};
  constructor(tables: Record<string, any[]>) {
    this.tables = tables;
  }
  from(table: string) {
    if (!this.tables[table]) this.tables[table] = [];
    return new FakeQuery(this.tables[table]);
  }
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  mockYahoo.quote.mockReset();
  mockYahoo.historical.mockReset();
  mockYahoo.search.mockReset();
});

// ── getQuotes ─────────────────────────────────────────────────────────

describe('getQuotes', () => {
  it('serves a fresh (<5 min) cache without calling Yahoo', async () => {
    mockServiceSupabase.mockReturnValue(
      new FakeSupabase({
        quote_cache: [{ ticker: 'XEQT.TO', price: 42.5, currency: 'CAD', as_of: minutesAgo(1) }],
      })
    );
    const out = await getQuotes(['XEQT.TO']);
    expect(out['XEQT.TO'].price).toBe(42.5);
    expect(mockYahoo.quote).not.toHaveBeenCalled();
  });

  it('refetches stale entries and upserts the cache', async () => {
    const db = new FakeSupabase({
      quote_cache: [{ ticker: 'XEQT.TO', price: 40, currency: 'CAD', as_of: minutesAgo(60) }],
    });
    mockServiceSupabase.mockReturnValue(db);
    mockYahoo.quote.mockResolvedValue([{ symbol: 'XEQT.TO', regularMarketPrice: 42.5, currency: 'CAD' }]);

    const out = await getQuotes(['XEQT.TO']);
    expect(out['XEQT.TO'].price).toBe(42.5);
    expect(mockYahoo.quote).toHaveBeenCalledWith('XEQT.TO');
    expect(db.tables.quote_cache[0].price).toBe(42.5);
    expect(new Date(db.tables.quote_cache[0].as_of).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('fetches tickers that are not in the cache at all', async () => {
    mockServiceSupabase.mockReturnValue(new FakeSupabase({}));
    mockYahoo.quote.mockResolvedValue([{ symbol: 'VTI', regularMarketPrice: 300, currency: 'USD' }]);
    const out = await getQuotes(['VTI']);
    expect(out['VTI'].price).toBe(300);
    expect(mockYahoo.quote).toHaveBeenCalledWith('VTI');
  });

  it('throws when every ticker fails', async () => {
    mockServiceSupabase.mockReturnValue(new FakeSupabase({}));
    mockYahoo.quote.mockRejectedValue(new Error('yahoo down'));
    await expect(getQuotes(['VTI'])).rejects.toThrow('market data unavailable');
  });
});

// ── getHistory ────────────────────────────────────────────────────────

describe('getHistory', () => {
  it('merges cache with fetched months and upserts only missing dates', async () => {
    const db = new FakeSupabase({
      price_cache: [
        { ticker: 'XEQT.TO', price_date: '2025-01-01', close: 40 },
        { ticker: 'XEQT.TO', price_date: '2025-02-01', close: 41 },
      ],
    });
    mockServiceSupabase.mockReturnValue(db);
    mockYahoo.historical.mockResolvedValue([
      { date: '2025-01-01T00:00:00Z', close: 40 },
      { date: '2025-02-01T00:00:00Z', close: 41 },
      { date: '2025-03-01T00:00:00Z', close: 42 },
    ]);

    const points = await getHistory('XEQT.TO', '1y');
    expect(points.map((p) => p.close)).toEqual([40, 41, 42]); // sorted, merged
    const upserted = (mockServiceSupabase.mock.results[0].value as FakeSupabase);
    expect(upserted.tables.price_cache).toHaveLength(3); // cached rows kept, only 2025-03 added
  });

  it('returns fetched points when nothing is cached', async () => {
    mockServiceSupabase.mockReturnValue(new FakeSupabase({}));
    mockYahoo.historical.mockResolvedValue([
      { date: '2025-01-01T00:00:00Z', close: 40 },
      { date: '2025-02-01T00:00:00Z', close: 41 },
    ]);
    const points = await getHistory('XEQT.TO', '1y');
    expect(points).toEqual([
      { date: '2025-01-01', close: 40 },
      { date: '2025-02-01', close: 41 },
    ]);
  });
});

// ── searchInstruments ─────────────────────────────────────────────────

describe('searchInstruments', () => {
  it('returns at most 8 {ticker, name} results, skipping non-quote entries and duplicates', async () => {
    mockYahoo.search.mockResolvedValue({
      quotes: [
        { symbol: 'T0', shortname: 'Name 0' },
        { symbol: 'T0', shortname: 'Duplicate 0' }, // dup ticker, skipped
        { name: 'A news item', permalink: 'p', index: 'x', isYahooFinance: false }, // no symbol, skipped
        ...Array.from({ length: 17 }, (_, i) => ({ symbol: `T${i + 1}`, shortname: `Name ${i + 1}` })),
      ],
    });
    const results = await searchInstruments('xeqt');
    expect(results).toHaveLength(8);
    expect(results[0]).toEqual({ ticker: 'T0', name: 'Name 0' });
    expect(results[7]).toEqual({ ticker: 'T7', name: 'Name 7' });
  });
});