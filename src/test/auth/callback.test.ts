import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../app/api/auth/callback/route';

const mocks = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (values: unknown[]) => void } }) => ({
    auth: { exchangeCodeForSession: async (code: string) => {
      const result = await mocks.exchange(code);
      if (!result.error) options.cookies.setAll([{ name: 'test-session', value: 'test-only', options: { httpOnly: true, path: '/' } }]);
      return result;
    } },
  }),
}));

describe('authentication callback', () => {
  beforeEach(() => mocks.exchange.mockReset());
  it('redirects invalid recovery links to a new reset request', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/auth/callback?next=/update-password'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/forgot-password?error=authentication');
  });
  it('sets session cookies on the password-update redirect', async () => {
    mocks.exchange.mockResolvedValue({ error: null });
    const response = await GET(new NextRequest('http://localhost:3000/api/auth/callback?code=test&next=/update-password'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/update-password');
    expect(response.cookies.get('test-session')?.value).toBe('test-only');
  });
  it('does not accept external redirect destinations', async () => {
    mocks.exchange.mockResolvedValue({ error: null });
    const response = await GET(new NextRequest('http://localhost:3000/api/auth/callback?code=test&next=https://example.com'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
  });
  it('shows a sign-in error after a rejected exchange', async () => {
    mocks.exchange.mockResolvedValue({ error: { message: 'Expired' } });
    const response = await GET(new NextRequest('http://localhost:3000/api/auth/callback?code=test'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/login?error=authentication');
    expect(response.cookies.get('test-session')).toBeUndefined();
  });
});
