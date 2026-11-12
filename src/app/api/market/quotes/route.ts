import { NextRequest, NextResponse } from 'next/server';
import { getQuotes } from '@/lib/market/yahoo';

import { isSignedIn } from '@/lib/supabase/api-auth';
import { serverSupabase } from '@/lib/supabase/server';
import { listedTickers, MAX_QUOTE_TICKERS } from '@/lib/market/tickers';

export const dynamic = 'force-dynamic';

/** GET /api/market/quotes?tickers=XEQT.TO,VTI */
export async function GET(request: NextRequest) {
  if (!(await isSignedIn())) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const requested = (request.nextUrl.searchParams.get('tickers') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (requested.length === 0) {
    return NextResponse.json({ error: 'tickers parameter required' }, { status: 400 });
  }
  if (requested.length > MAX_QUOTE_TICKERS) {
    return NextResponse.json({ error: `Request at most ${MAX_QUOTE_TICKERS} tickers` }, { status: 400 });
  }
  const tickers = await listedTickers(await serverSupabase(), requested).catch(() => []);
  if (tickers.length === 0) return NextResponse.json({ quotes: {} });
  try {
    const quotes = await getQuotes(tickers);
    return NextResponse.json({ quotes });
  } catch (error) {
    // A provider throttle is an expected temporary condition. Returning a
    // successful empty result lets clients retain their last known values
    // instead of treating every polling cycle as an application failure.
    const reason = error instanceof Error ? error.message : 'Unknown market-data error';
    console.error('Market quote request failed:', { tickers, reason });
    return NextResponse.json({ quotes: {}, available: false, retryAfterSeconds: 600, reason });
  }
}
