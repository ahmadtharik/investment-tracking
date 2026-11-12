import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listedTickers } from '@/lib/market/tickers';

const db = {
  from: () => ({ select: () => ({ in: async (_column: string, tickers: string[]) => ({ data: tickers.filter((t) => t === 'XEQT.TO').map((ticker) => ({ ticker })), error: null }) }) }),
} as unknown as SupabaseClient;

describe('listedTickers', () => {
  it('keeps listed tickers and the FX rate, and drops unknown or malformed ones', async () => {
    expect(await listedTickers(db, ['XEQT.TO', 'CAD=X', 'RANDOM', 'bad ticker!', 'XEQT.TO'])).toEqual(['XEQT.TO', 'CAD=X']);
  });
});
