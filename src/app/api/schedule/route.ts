import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { getSchedule, resolveCycle } from '@/lib/db/queries';
import { dueAfter, todayInToronto } from '@/lib/engine/schedule';
import { currentInstalment, pricedLines, settleDueCycles } from '@/lib/schedule/settle';

export const dynamic = 'force-dynamic';

/** POST /api/schedule { action: 'settle' | 'early' } */
export async function POST(request: NextRequest) {
  const db = await serverSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const body = await request.json().catch(() => null);

  if (body?.action === 'settle') {
    await settleDueCycles(db, user.id);
    return NextResponse.json({ ok: true });
  }
  if (body?.action !== 'early') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const schedule = await getSchedule(db, user.id);
  if (!schedule) return NextResponse.json({ error: 'No schedule is set up' }, { status: 400 });
  const lines = await currentInstalment(db, user.id);
  if (lines.length === 0) return NextResponse.json({ error: 'Your plan has no monthly amount to record' }, { status: 400 });
  try {
    const today = todayInToronto();
    const result = await resolveCycle(db, { due: schedule.next_due, status: 'early', lines: await pricedLines(lines, today, today), nextDue: dueAfter(schedule.next_due, schedule.day_of_month) });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Could not record this instalment' }, { status: 500 });
  }
}
