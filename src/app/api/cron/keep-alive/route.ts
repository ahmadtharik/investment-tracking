import { NextResponse, type NextRequest } from 'next/server';
import { serviceSupabase } from '@/lib/supabase/server';
import { settleAllUsers } from '@/lib/schedule/settle';
import { resetDemoAccount } from '@/lib/demo/seed';
import { todayInToronto } from '@/lib/engine/schedule';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/cron/keep-alive: daily Vercel Cron. Keeps Supabase active and records due instalments. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const service = serviceSupabase();
  const { error } = await service.from('instruments').select('id').limit(1);
  if (error) return NextResponse.json({ error: 'Database check failed' }, { status: 500 });
  // A failed demo reset must not stop real users' instalments from recording.
  try {
    await resetDemoAccount(service, todayInToronto());
  } catch (caught) {
    console.error('Demo reset failed:', caught instanceof Error ? caught.message : caught);
  }
  try {
    const result = await settleAllUsers(service, 45_000);
    // A non-200 shows the run as failed in Vercel's logs, so a user who can't be settled gets noticed.
    return NextResponse.json({ ok: result.failed === 0, ...result }, { status: result.failed === 0 ? 200 : 500 });
  } catch (caught) {
    console.error('Daily recording failed:', caught instanceof Error ? caught.message : caught);
    return NextResponse.json({ error: 'Daily recording failed' }, { status: 500 });
  }
}
