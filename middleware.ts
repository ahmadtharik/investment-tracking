import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Refreshes the Supabase auth session cookies on each matched request.
 * Actual redirect-to-login enforcement happens in the (app) layout via authGuard().
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // IMPORTANT: do not move the line below.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/accounts/:path*',
    '/portfolio/:path*',
    '/fx/:path*',
    '/projections/:path*',
    '/rules/:path*',
  ],
};