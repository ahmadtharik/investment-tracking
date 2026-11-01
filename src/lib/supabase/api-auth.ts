import { serverSupabase } from './server';

/** Session check for API routes, which return a 401 rather than redirecting. */
export async function isSignedIn(): Promise<boolean> {
  const db = await serverSupabase();
  const { data: { user } } = await db.auth.getUser();
  return Boolean(user);
}
