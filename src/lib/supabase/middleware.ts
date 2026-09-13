import 'server-only';
import { redirect } from 'next/navigation';
import { serverSupabase } from './server';

/**
 * Server-side session guard. Returns the authed user or redirects to /login.
 * Used by the (app) route-group layout so every app page requires sign-in.
 */
export async function authGuard() {
  const supabase = await serverSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/login');
  return user;
}