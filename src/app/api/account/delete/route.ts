import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase, serviceSupabase } from '@/lib/supabase/server';
import { isDemoUser } from '@/lib/demo/seed';

export const dynamic = 'force-dynamic';

/** POST /api/account/delete { confirm: 'DELETE' }: every user table cascades from auth.users. */
export async function POST(request: NextRequest) {
  const db = await serverSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  if (isDemoUser(user.id)) return NextResponse.json({ error: 'The demo account can\'t be deleted' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.confirm !== 'DELETE') return NextResponse.json({ error: 'Confirmation required' }, { status: 400 });
  const { error } = await serviceSupabase().auth.admin.deleteUser(user.id);
  if (error) {
    console.error('Account deletion failed:', error.message);
    return NextResponse.json({ error: 'Could not delete your account' }, { status: 500 });
  }
  await db.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
