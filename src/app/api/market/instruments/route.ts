import { NextResponse, type NextRequest } from 'next/server';
import { serviceSupabase } from '@/lib/supabase/server';
import { upsertInstrument } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/market/instruments  { ticker, name?, currency? }
 * Adds a ticker discovered via Yahoo search to the shared instrument list
 * (service-role write, since RLS restricts instruments to read-only).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const ticker = typeof body?.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : ticker;
  const currency = body?.currency === 'USD' ? 'USD' : 'CAD';

  try {
    const instrument = await upsertInstrument(serviceSupabase(), ticker, name, currency);
    return NextResponse.json({ instrument });
  } catch {
    return NextResponse.json({ error: 'could not save instrument' }, { status: 500 });
  }
}