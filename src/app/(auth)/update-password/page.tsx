'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { clientSupabase } from '@/lib/supabase/client';
import { AuthFrame, authInput, authButton } from '@/components/public/auth-frame';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        if (new URLSearchParams(window.location.hash.slice(1)).has('error')) { if (active) setReady(false); return; }
        const { data: { user }, error } = await clientSupabase().auth.getUser();
        if (active) setReady(Boolean(user) && !error);
      } catch { if (active) setReady(false); }
    };
    void check();
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !ready) return;
    setMessage('');
    if (password.length < 8) { setMessage('Use at least 8 characters.'); return; }
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const db = clientSupabase();
      const { data: { user } } = await db.auth.getUser();
      if (!user) { setReady(false); return; }
      const { error } = await db.auth.updateUser({ password });
      if (error) throw error;
      setPassword(''); setConfirm(''); setDone(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update password. Try again.'); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow="A fresh start" title={done ? 'You’re all set.' : ready === false ? 'Let’s try a new link.' : 'Choose a new password.'} description={done ? 'Your password has been updated. You can return to your planner.' : ready === false ? 'A valid reset link or an active sign-in is needed to update your password.' : 'Use a strong password you don’t use elsewhere.'}>
    {ready === null && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700">Checking your session…</p>}
    {ready === false && <div><p role="alert" className="mb-5 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-slate-600">Your session or reset link may have expired. Request a new email and open the latest link in this browser.</p><Link href="/forgot-password" className={authButton}>Request a new reset link</Link></div>}
    {ready && !done && <form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="space-y-5"><label className="block text-sm font-medium">New password<input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} className={authInput} placeholder="At least 8 characters" /></label><label className="block text-sm font-medium">Confirm new password<input required minLength={8} autoComplete="new-password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} className={authInput} placeholder="Enter your new password again" /></label></fieldset>{message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}<button disabled={busy} className={authButton}>{busy ? 'Updating password…' : 'Update password'}</button></form>}
    {done && <div><p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">Password updated successfully.</p><Link href="/dashboard" className={authButton}>Return to your planner →</Link></div>}
    {!done && <Link href="/login" className="mt-7 block text-center text-sm font-semibold text-slate-500 hover:text-blue-600">← Back to sign in</Link>}
  </AuthFrame>;
}
