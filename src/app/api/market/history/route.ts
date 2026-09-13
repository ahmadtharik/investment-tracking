import { NextRequest, NextResponse } from 'next/server';
import { getHistory } from '@/lib/market/yahoo';

export const dynamic = 'force-dynamic';

/** GET /api/market/history?ticker=XEQT.TO&period=5y  (period: 1y|2y|5y|max) */
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const period = (request.nextUrl.searchParams.get('period') ?? '5y') as '1y' | '2y' | '5y' | 'max';
  if (!ticker) {
    return NextResponse.json({ error: 'ticker parameter required' }, { status: 400 });
  }
  if (!['1y', '2y', '5y', 'max'].includes(period)) {
    return NextResponse.json({ error: 'period must be 1y, 2y, 5y or max' }, { status: 400 });
  }
  try {
    const points = await getHistory(ticker, period);
    return NextResponse.json({ points });
  } catch {
    return NextResponse.json({ error: 'market data unavailable' }, { status: 503 });
  }
}