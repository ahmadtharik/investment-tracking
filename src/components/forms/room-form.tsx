'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';
import { saveProfile, type Profile } from '@/lib/db/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';

export function RoomForm({ userId, profile }: { userId: string; profile: Profile }) {
  const router = useRouter();
  useEffect(() => { setTfsa(String(profile.tfsa_room)); setRrsp(String(profile.rrsp_room)); }, [profile.tfsa_room, profile.rrsp_room]);
  const [tfsa, setTfsa] = useState(String(profile.tfsa_room ?? 0));
  const [rrsp, setRrsp] = useState(String(profile.rrsp_room ?? 0));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const tfsaRoom = Number(tfsa);
    const rrspRoom = Number(rrsp);
    if (!Number.isFinite(tfsaRoom) || tfsaRoom < 0 || !Number.isFinite(rrspRoom) || rrspRoom < 0) {
      setMessage('Room must be a non-negative number.');
      return;
    }
    setSaving(true);
    try {
      await saveProfile(clientSupabase(), userId, { tfsa_room: tfsaRoom, rrsp_room: rrspRoom });
      setMessage('Saved ✓');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save room');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-4" noValidate>
      <fieldset disabled={saving} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="TFSA available room (CAD)" htmlFor="tfsaRoom">
          <Input id="tfsaRoom" type="number" min={0} step="any" value={tfsa} onChange={(e) => setTfsa(e.target.value)} />
        </Field>
        <Field label="RRSP available room (CAD)" htmlFor="rrspRoom">
          <Input id="rrspRoom" type="number" min={0} step="any" value={rrsp} onChange={(e) => setRrsp(e.target.value)} />
        </Field>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
<Button type="submit" loading={saving} loadingLabel="Saving…">Save room</Button><Button variant="secondary" disabled={saving} onClick={()=>{setTfsa(String(profile.tfsa_room));setRrsp(String(profile.rrsp_room));setMessage(null);}}>Cancel</Button>
        {message && <span className="text-sm text-zinc-500 dark:text-zinc-400">{message}</span>}
      </div>
    </form>
  );
}
