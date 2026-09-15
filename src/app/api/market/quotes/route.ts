import { NextRequest, NextResponse } from 'next/server';
import { getQuotes } from '@/lib/market/yahoo';

export const dynamic = 'force-dynamic';

/** GET /api/market/quotes?tickers=XEQT.TO,VTI */
export async function GET(request: NextRequest) {
  const tickers = (request.nextUrl.searchParams.get('tickers') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  if (tickers.length === 0) {
    return NextResponse.json({ error: 'tickers parameter required' }, { status: 400 });
  }
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
