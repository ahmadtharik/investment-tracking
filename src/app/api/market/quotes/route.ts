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
  } catch {
    return NextResponse.json({ error: 'market data unavailable' }, { status: 503 });
  }
}