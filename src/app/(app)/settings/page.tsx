import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations } from '@/lib/db/queries';
import { SettingsHub } from '@/components/settings-hub';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const accountAlloc = await getAccountAllocations(db, user.id);
  const displayName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Your profile');
  return <div className="mx-auto w-full max-w-[1276px]"><h1 className="text-[28px] font-bold tracking-tight">Settings</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Manage your preferences and application settings.</p><SettingsHub userId={user.id} displayName={displayName} email={user.email ?? ''} accountAlloc={accountAlloc} /></div>;
}
