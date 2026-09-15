'use client';

import { useState } from 'react';
import type { InstrumentRow, Profile } from '@/lib/db/queries';
import { SetupWizard } from '@/components/forms/setup-wizard';

export function SetupLauncher({ userId, profile, instruments, label = 'Begin setup' }: { userId: string; profile: Profile; instruments: InstrumentRow[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex text-sm font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300">{label}</button>{open && <SetupWizard userId={userId} profile={profile} instruments={instruments} onComplete={() => { setOpen(false); window.location.reload(); }} />}</>;
}
