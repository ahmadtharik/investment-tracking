import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

export async function GET() {
  const db = await serverSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const tables = ['profiles', 'account_alloc', 'instrument_alloc', 'holdings', 'contributions', 'withdrawals', 'fx_prefs'] as const;
  const results = await Promise.all(tables.map(table => db.from(table).select('*').eq(table === 'profiles' ? 'id' : 'user_id', user.id)));
  if (results.some(result => result.error)) return NextResponse.json({ error: 'Export failed. Please try again.' }, { status: 500 });
  const content = { exportedAt: new Date().toISOString(), profile: { name: user.user_metadata.full_name ?? user.user_metadata.name, email: user.email }, ...Object.fromEntries(tables.map((table, i) => [table, results[i].data])) };
  return new NextResponse(JSON.stringify(content, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="investment-planner-data.json"', 'Cache-Control': 'no-store' } });
}
