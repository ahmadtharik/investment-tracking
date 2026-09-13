import yahoo from 'yahoo-finance2';
import { serviceSupabase } from '@/lib/supabase/server';

export interface QuotePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

const QUOTE_TTL_MS = 5 * 60 * 1000;

/**
 * Latest quotes for the given tickers. Cache-first: entries less than 5 minutes
 * old are served from quote_cache; everything else is fetched from Yahoo and
 * written back to the cache via the service-role client.
 * Throws 'market data unavailable' when no quote could be resolved at all.
 */
export async function getQuotes(tickers: string[]) {
  const db = serviceSupabase();
  const out: Record<string, { price: number; currency: string; asOf: string }> = {};
  const toFetch: string[] = [];
  const { data } = await db.from('quote_cache').select('ticker, price, currency, as_of').in('ticker', tickers);
  const now = Date.now();
  for (const row of data ?? []) {
    if (now - new Date(row.as_of).getTime() < QUOTE_TTL_MS) {
      out[row.ticker] = { price: row.price, currency: row.currency, asOf: row.as_of };
    } else {
      toFetch.push(row.ticker);
    }
  }
  for (const ticker of tickers) {
    if (!(data ?? []).some((r) => r.ticker === ticker) && !toFetch.includes(ticker)) toFetch.push(ticker);
  }

  for (const ticker of toFetch) {
    try {
      const q = await yahoo.quote(ticker);
      const row = Array.isArray(q) ? q[0] : q;
      const price = row?.regularMarketPrice;
      if (price == null) continue;
      out[ticker] = { price, currency: row.currency ?? 'CAD', asOf: new Date().toISOString() };
      await db
        .from('quote_cache')
        .upsert({ ticker, price, currency: row.currency ?? 'CAD', as_of: new Date().toISOString() });
    } catch {
      // Leave this ticker missing — if everything fails we throw below.
    }
  }

  if (tickers.length > 0 && Object.keys(out).length === 0) throw new Error('market data unavailable');
  return out;
}

/**
 * Monthly closes for a ticker over the requested period. Always fetches from
 * Yahoo (monthly bars are cheap) and upserts dates missing from price_cache;
 * cached rows are merged back in so the response is sorted and deduped.
 */
export async function getHistory(ticker: string, period: '1y' | '2y' | '5y' | 'max'): Promise<QuotePoint[]> {
  const db = serviceSupabase();
  const months = { '1y': 12, '2y': 24, '5y': 60, max: 240 }[period];
  const from = new Date();
  from.setMonth(from.getMonth() - months);

  const { data: cached } = await db
    .from('price_cache')
    .select('price_date, close')
    .eq('ticker', ticker)
    .gte('price_date', from.toISOString().slice(0, 10));

  const history = await yahoo.historical(ticker, {
    period1: new Date(from),
    period2: new Date(),
    interval: '1mo',
    events: 'history',
  });
  const points: QuotePoint[] = history.map((bar: any) => ({
    date: new Date(bar.date).toISOString().slice(0, 10),
    close: bar.close,
  }));

  const cachedDates = new Set((cached ?? []).map((r: any) => r.price_date));
  const missing = points.filter((p) => !cachedDates.has(p.date));
  if (missing.length > 0) {
    await db.from('price_cache').upsert(missing.map((p) => ({ ticker, price_date: p.date, close: p.close })));
  }

  const merged = [
    ...(cached ?? []).map((r: any) => ({ date: r.price_date, close: r.close })),
    ...missing,
  ];
  return merged.sort((a, b) => a.date.localeCompare(b.date));
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