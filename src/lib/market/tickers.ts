import type { SupabaseClient } from '@supabase/supabase-js';
import { USD_CAD_TICKER } from '@/lib/valuation';

export const TICKER_PATTERN = /^[A-Z0-9.^=\-]{1,30}$/;
export const MAX_QUOTE_TICKERS = 25;

/** The requested tickers that are on the shared instrument list, plus the FX rate. Keeps the market routes from fetching arbitrary symbols. */
export async function listedTickers(db: SupabaseClient, tickers: string[]): Promise<string[]> {
  const wanted = [...new Set(tickers.filter((ticker) => TICKER_PATTERN.test(ticker)))];
  const lookup = wanted.filter((ticker) => ticker !== USD_CAD_TICKER);
  const { data, error } = lookup.length ? await db.from('instruments').select('ticker').in('ticker', lookup) : { data: [], error: null };
  if (error) throw error;
  const listed = new Set((data ?? []).map((row) => row.ticker as string));
  return wanted.filter((ticker) => ticker === USD_CAD_TICKER || listed.has(ticker));
}
