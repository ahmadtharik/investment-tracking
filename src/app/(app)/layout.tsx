import { authGuard } from '@/lib/supabase/middleware';
import { Nav } from '@/components/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Any signed-out visitor hitting an app route is redirected to /login.
  await authGuard();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 md:ml-64 md:px-10 md:py-10">{children}</main>
    </>
  );
}
