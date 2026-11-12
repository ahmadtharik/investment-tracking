import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase, serviceSupabase } from '@/lib/supabase/server';
import { restoreDemoLogin } from '@/lib/demo/seed';

export const dynamic = 'force-dynamic';

/** POST /api/demo/login: signs a visitor in to the shared demo account, keeping its password on the server. */
export async function POST(request: NextRequest) {
  // Only this site's own button may start a demo session, so another site can't swap a visitor's session for the demo.
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== request.headers.get('host')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return NextResponse.redirect(new URL('/login', request.url), 303);
  const db = await serverSupabase();
  let { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    // A visitor can change the demo password through Supabase directly. Put it back and try once more.
    const restored = await restoreDemoLogin(serviceSupabase()).catch(() => false);
    if (restored) ({ error } = await db.auth.signInWithPassword({ email, password }));
  }
  if (error) {
    console.error('Demo sign-in failed:', error.message);
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }
  return NextResponse.redirect(new URL('/dashboard', request.url), 303);
}
