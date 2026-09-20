'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clientSupabase } from '@/lib/supabase/client';
import { AuthFrame, authInput, authButton } from '@/components/public/auth-frame';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (new URLSearchParams(window.location.search).has('error')) setError('That reset link has expired or could not be verified. Request a new link below.'); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { error } = await clientSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/api/auth/callback?next=/update-password` });
      if (error) throw error;
      setSent(true);
    } catch { setError('We could not send the request. Please wait a moment and try again.'); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow="Let’s get you back in" title={sent ? 'Check your inbox.' : 'Forgot your password?'} description={sent ? 'If an account exists for that email, you’ll receive a link to choose a new password.' : 'Enter the email address you use for your planner. We’ll send you a password-reset link.'}>
    {sent ? <div><div role="status" className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-slate-600"><p className="font-semibold text-slate-900">Your next step is in your email.</p><p className="mt-2">Follow the latest reset link, preferably in this browser. Check your spam folder if it doesn’t arrive.</p></div><button className="mt-6 w-full text-sm font-semibold text-blue-600" onClick={()=>{setSent(false);setError('');}}>Use a different email or try again</button></div> : <form onSubmit={submit} className="space-y-5"><label className="block text-sm font-medium">Email address<input type="email" name="email" autoComplete="email" required disabled={busy} value={email} onChange={e=>setEmail(e.target.value)} className={authInput} placeholder="you@example.com" /></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{error}</p>}<button type="submit" disabled={busy} className={authButton}>{busy ? 'Sending request…' : 'Send reset link'}</button></form>}
    <Link href="/login" className="mt-7 block text-center text-sm font-semibold text-slate-500 hover:text-blue-600">← Back to sign in</Link>
  </AuthFrame>;
}
