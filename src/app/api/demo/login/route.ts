import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST /api/demo/login: signs a visitor in to the shared demo account, keeping its password on the server. */
export async function POST(request: NextRequest) {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return NextResponse.redirect(new URL('/login', request.url), 303);
  const db = await serverSupabase();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Demo sign-in failed:', error.message);
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }
  return NextResponse.redirect(new URL('/dashboard', request.url), 303);
}
