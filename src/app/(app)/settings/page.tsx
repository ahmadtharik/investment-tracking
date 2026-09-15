import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import {
  getAccountAllocations,
  getEtfAllocations,
  getOrCreateProfile,
  listInstruments,
} from '@/lib/db/queries';
import { SettingsForm } from '@/components/forms/settings-form';
import { Card } from '@/components/ui/card';
import { SetupLauncher } from '@/components/forms/setup-launcher';

export default async function SettingsPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments] = await Promise.all([
    getOrCreateProfile(db, user.id),
    getAccountAllocations(db, user.id),
    getEtfAllocations(db, user.id),
    listInstruments(db),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your monthly numbers and allocation rules. The dashboard, projections, and backtests all use these values.
      </p>
      {profile.monthly_income === 0 && profile.monthly_expenses === 0 && accountAlloc.length === 0 && etfAlloc.length === 0 && <Card className="mt-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <h2 className="font-semibold">Start with your monthly numbers</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">These settings drive the dashboard allocation, contribution room checks, and projections. You can update them any time.</p>
        <SetupLauncher userId={user.id} profile={profile} instruments={instruments} label="Begin setup below" />
      </Card>}
      <div id="settings-form" className="mt-6">
        <SettingsForm
          userId={user.id}
          profile={profile}
          accountAlloc={accountAlloc}
          etfAlloc={etfAlloc}
          instruments={instruments}
        />
      </div>
    </div>
  );
}
