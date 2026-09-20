'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';

export function ProfileEditor({ name }: { name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const { error } = await clientSupabase().auth.updateUser({ data: { full_name: draft.trim() } });
      if (error) throw error;
      setEditing(false); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update your name.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-3">{editing ? <form onSubmit={save} className="space-y-2"><label className="block text-sm">Display name<input autoFocus required maxLength={100} value={draft} onChange={e => setDraft(e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label><button disabled={busy || !draft.trim()} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">{busy ? 'Saving…' : 'Save name'}</button><button type="button" disabled={busy} onClick={() => { setEditing(false); setDraft(name); setMessage(''); }} className="ml-2 px-3 py-2 text-sm">Cancel</button></form> : <button onClick={() => { setDraft(name); setEditing(true); }} className="text-sm font-semibold text-blue-600">Edit display name</button>}<p role="status" className="text-sm text-red-600">{message}</p></div>;
}
