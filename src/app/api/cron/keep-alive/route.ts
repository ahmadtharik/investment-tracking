import { NextResponse, type NextRequest } from 'next/server';
import { serviceSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/cron/keep-alive: daily Vercel Cron query so Supabase doesn't pause the project. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { error } = await serviceSupabase().from('instruments').select('id').limit(1);
  if (error) return NextResponse.json({ error: 'Database check failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
