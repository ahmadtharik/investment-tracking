export const USD_CAD_TICKER = 'CAD=X';

type Valued = { ticker: string; units: number; balance_native: number; currency: string; fx_rate: number };
type Quotes = Record<string, { price: number } | undefined>;

/**
 * A holding's current CAD value: live price when units are known, otherwise the
 * recorded balance. USD uses the live rate, falling back to the holding's saved rate.
 */
export function holdingValueCad(holding: Valued, quotes: Quotes): number {
  const quote = quotes[holding.ticker];
  const native = quote && holding.units > 0 ? holding.units * quote.price : holding.balance_native;
  if (holding.currency !== 'USD') return native;
  return native * (quotes[USD_CAD_TICKER]?.price ?? holding.fx_rate);
}

/** Tickers to quote for valuing these holdings, including the FX rate when needed. */
export function valuationTickers(holdings: { ticker: string; currency: string }[]): string[] {
  const tickers = new Set(holdings.map((holding) => holding.ticker).filter(Boolean));
  if (holdings.some((holding) => holding.currency === 'USD')) tickers.add(USD_CAD_TICKER);
  return [...tickers];
}

/** Gain or loss on a set of holdings. Null unless every holding's cost is known. */
export function gainCad(holdings: (Valued & { cost_cad?: number | null })[], quotes: Quotes): { gain: number; cost: number } | null {
  if (holdings.length === 0 || holdings.some((holding) => holding.cost_cad == null)) return null;
  const cost = holdings.reduce((sum, holding) => sum + Number(holding.cost_cad), 0);
  const value = holdings.reduce((sum, holding) => sum + holdingValueCad(holding, quotes), 0);
  return { gain: value - cost, cost };
}
