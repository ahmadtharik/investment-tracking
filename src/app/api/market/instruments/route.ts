import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase, serviceSupabase } from '@/lib/supabase/server';
import { upsertInstrument } from '@/lib/db/queries';
import { isDemoUser } from '@/lib/demo/seed';
import { lookupInstrument } from '@/lib/market/yahoo';
import { TICKER_PATTERN } from '@/lib/market/tickers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/market/instruments  { ticker }
 * Adds a ticker to the shared instrument list (service-role write, since RLS
 * restricts instruments to read-only). The name and currency come from Yahoo,
 * never the client, because every user shares the first row written.
 */
export async function POST(request: NextRequest) {
  const db = await serverSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  // The instrument list is shared with real users, so visitors can't add to it.
  if (isDemoUser(user.id)) return NextResponse.json({ error: 'The demo account can only use investments already listed.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const ticker = typeof body?.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
  if (!TICKER_PATTERN.test(ticker)) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }
  let found: Awaited<ReturnType<typeof lookupInstrument>>;
  try {
    found = await lookupInstrument(ticker);
  } catch {
    return NextResponse.json({ error: 'Market data is unavailable right now. Try again shortly.' }, { status: 503 });
  }
  if (!found) return NextResponse.json({ error: `Yahoo Finance doesn't recognize ${ticker}.` }, { status: 400 });
  if (found.currency !== 'CAD' && found.currency !== 'USD') {
    return NextResponse.json({ error: `${ticker} trades in ${found.currency}. Only CAD and USD investments are supported.` }, { status: 400 });
  }

  try {
    const instrument = await upsertInstrument(serviceSupabase(), ticker, found.name, found.currency);
    return NextResponse.json({ instrument });
  } catch {
    return NextResponse.json({ error: 'could not save instrument' }, { status: 500 });
  }
}
