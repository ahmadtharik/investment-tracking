'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: typed }) });
      if (!response.ok) throw new Error();
      window.location.assign('/');
    } catch {
      setError('Could not delete your account. Nothing was removed if this page still works; please try again.');
      setBusy(false);
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="w-full rounded-lg border border-rose-100 bg-rose-50/40 p-3 text-left text-sm font-semibold text-rose-600">Delete my account and data</button>;
  return <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3">
    <p className="text-sm font-semibold text-rose-700">This permanently deletes your account and everything in it. It can&apos;t be undone.</p>
    <p className="mt-1 text-xs text-rose-700">Download your data first if you want a copy. Type DELETE to confirm.</p>
    <Input aria-label="Type DELETE to confirm" className="mt-2" value={typed} disabled={busy} onChange={(e) => setTyped(e.target.value)} />
    <div className="mt-2 flex gap-2"><Button variant="danger" disabled={typed !== 'DELETE'} loading={busy} loadingLabel="Deleting…" onClick={remove}>Delete permanently</Button><Button variant="secondary" disabled={busy} onClick={() => { setOpen(false); setTyped(''); setError(null); }}>Cancel</Button></div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
