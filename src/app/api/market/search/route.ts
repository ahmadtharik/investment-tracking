import { NextRequest, NextResponse } from 'next/server';
import { searchInstruments } from '@/lib/market/yahoo';

export const dynamic = 'force-dynamic';

/** GET /api/market/search?q=xeqt */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'q parameter required' }, { status: 400 });
  }
  try {
    const results = await searchInstruments(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'market data unavailable' }, { status: 503 });
  }
}