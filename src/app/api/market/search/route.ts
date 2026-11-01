import { NextRequest, NextResponse } from 'next/server';
import { searchInstruments } from '@/lib/market/yahoo';

import { isSignedIn } from '@/lib/supabase/api-auth';

export const dynamic = 'force-dynamic';

/** GET /api/market/search?q=xeqt */
export async function GET(request: NextRequest) {
  if (!(await isSignedIn())) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'q parameter required' }, { status: 400 });
  }
  try {
    const results = await searchInstruments(q);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'Yahoo search is temporarily unavailable. Try again or add the ticker manually.' }, { status: 503 });
  }
}
