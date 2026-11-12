import YahooFinance from 'yahoo-finance2';
import { serviceSupabase } from '@/lib/supabase/server';

export interface QuotePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

const QUOTE_TTL_MS = 5 * 60 * 1000;
const QUOTE_COOLDOWN_MS = 10 * 60 * 1000;
let quoteCooldownUntil = 0;
const yahoo = new YahooFinance({ queue: { concurrency: 1, interval: 250 }, quoteCombine: { maxSymbolsPerRequest: 50, debounceTime: 75 }, suppressNotices: ['yahooSurvey'] });

/**
 * Latest quotes for the given tickers. Cache-first: entries less than 5 minutes
 * old are served from quote_cache; everything else is fetched from Yahoo and
 * written back to the cache via the service-role client.
 * Throws 'market data unavailable' when no quote could be resolved at all.
 */
export async function getQuotes(tickers: string[]) {
  // The cache is an optimisation, not a dependency. In particular, a local
  // installation without SUPABASE_SERVICE_ROLE_KEY must still be able to ask
  // Yahoo for a price.
  let db: ReturnType<typeof serviceSupabase> | undefined;
  try {
    db = serviceSupabase();
  } catch {
    db = undefined;
  }
  const out: Record<string, { price: number; currency: string; asOf: string }> = {};
  const stale: Record<string, { price: number; currency: string; asOf: string }> = {};
  let toFetch = [...new Set(tickers)];
  let data: Array<{ ticker: string; price: number; currency: string; as_of: string }> = [];
  if (db) {
    try {
      const cached = await db.from('quote_cache').select('ticker, price, currency, as_of').in('ticker', tickers);
      data = cached.data ?? [];
    } catch {
      // A missing cache table or unavailable Supabase project must not take
      // the market-data provider down with it.
    }
  }
  const now = Date.now();
  for (const row of data) {
    const cached = { price: row.price, currency: row.currency, asOf: row.as_of };
    if (now - new Date(row.as_of).getTime() < QUOTE_TTL_MS) {
      out[row.ticker] = cached;
    } else {
      stale[row.ticker] = cached;
    }
  }
  toFetch = toFetch.filter((ticker) => !out[ticker]);

  if (Date.now() < quoteCooldownUntil) {
    for (const ticker of toFetch) if (stale[ticker]) out[ticker] = stale[ticker];
  } else {
    await Promise.all(toFetch.map(async (ticker) => {
      try {
        const q = await yahoo.quoteCombine(ticker);
        const row = Array.isArray(q) ? q[0] : q;
        const price = row?.regularMarketPrice;
        if (price == null) return;
        const asOf = new Date().toISOString();
        out[ticker] = { price, currency: row.currency ?? 'CAD', asOf };
        if (db) {
          try {
            await db.from('quote_cache').upsert({ ticker, price, currency: row.currency ?? 'CAD', as_of: asOf });
          } catch {
            // Keep the live result even if cache persistence fails.
          }
        }
      } catch (error) {
        if (error instanceof Error && /too many requests|429/i.test(error.message)) quoteCooldownUntil = Date.now() + QUOTE_COOLDOWN_MS;
        if (stale[ticker]) out[ticker] = stale[ticker];
      }
    }));
  }

  if (tickers.length > 0 && Object.keys(out).length === 0) throw new Error('market data unavailable');
  return out;
}

/**
 * Monthly closes for a ticker over the requested period. Always fetches from
 * Yahoo (monthly bars are cheap) and rewrites the fetched bars in price_cache,
 * because the current month's bar keeps changing until the month ends. Cached
 * rows fill in only what Yahoo didn't return.
 */
export async function getHistory(ticker: string, period: '1y' | '2y' | '5y' | 'max'): Promise<QuotePoint[]> {
  let db: ReturnType<typeof serviceSupabase> | undefined;
  try {
    db = serviceSupabase();
  } catch {
    db = undefined;
  }
  const months = { '1y': 12, '2y': 24, '5y': 60, max: 240 }[period];
  const from = new Date();
  from.setMonth(from.getMonth() - months);

  let cached: Array<{ price_date: string; close: number }> = [];
  if (db) {
    try {
      const result = await db
        .from('price_cache')
        .select('price_date, close')
        .eq('ticker', ticker)
        .gte('price_date', from.toISOString().slice(0, 10));
      cached = result.data ?? [];
    } catch {
      // Historical data can still be served directly from Yahoo.
    }
  }

  let history: any[] = [];
  try {
    history = await yahoo.historical(ticker, {
      period1: new Date(from),
      period2: new Date(),
      interval: '1mo',
      events: 'history',
    });
  } catch (error) {
    const fallback = cached.map((r) => ({ date: r.price_date, close: r.close }));
    if (fallback.length > 0) return fallback.sort((a, b) => a.date.localeCompare(b.date));
    throw new Error(`Historical market data unavailable for ${ticker}`);
  }
  // Yahoo adds a live bar dated today after the month's own bar; keep one bar per month.
  const points = oneBarPerMonth(history.map((bar: any) => ({
    date: new Date(bar.date).toISOString().slice(0, 10),
    close: bar.close,
  })));

  if (db && points.length > 0) {
    try {
      await db.from('price_cache').upsert(points.map((p) => ({ ticker, price_date: p.date, close: p.close })));
    } catch {
      // Cache writes are best-effort.
    }
  }

  const byDate = new Map(cached.map((r) => [r.price_date, { date: r.price_date, close: r.close }]));
  for (const point of points) byDate.set(point.date, point);
  return oneBarPerMonth([...byDate.values()]);
}

/** The earliest-dated bar in each month, sorted by date. */
function oneBarPerMonth(points: QuotePoint[]): QuotePoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.filter((point, index) => index === 0 || sorted[index - 1].date.slice(0, 7) !== point.date.slice(0, 7));
}

/** Name and currency for a ticker, from Yahoo. Null when Yahoo doesn't recognize it. Throws when Yahoo can't be reached. */
export async function lookupInstrument(ticker: string): Promise<{ name: string; currency: string } | null> {
  const result = await yahoo.quote(ticker);
  const row = Array.isArray(result) ? result[0] : result;
  if (!row || row.symbol?.toUpperCase() !== ticker || !row.currency) return null;
  return { name: (row.longName ?? row.shortName ?? ticker).slice(0, 200), currency: row.currency };
}

/** Yahoo symbol search, capped at 8 results. */
export async function searchInstruments(q: string) {
  const r = await yahoo.search(q);
  // `quotes` is a mixed array: Yahoo market entries carry `symbol`;
  // news/list entries only have `permalink`/`name` and are filtered out.
  const entries = (r.quotes ?? []) as Array<{ symbol?: string; shortname?: string; longname?: string }>;
  const seen = new Set<string>();
  const out: { ticker: string; name: string }[] = [];
  for (const e of entries) {
    if (!e.symbol || seen.has(e.symbol)) continue;
    seen.add(e.symbol);
    out.push({ ticker: e.symbol, name: e.shortname ?? e.longname ?? e.symbol });
    if (out.length === 8) break;
  }
  return out;
}
