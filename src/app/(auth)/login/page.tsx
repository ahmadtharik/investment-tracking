'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientSupabase } from '@/lib/supabase/client';
import { AuthFrame, authInput, authButton } from '@/components/public/auth-frame';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('mode') === 'signup') setMode('signUp');
    if (query.has('error')) setError('This sign-in link could not be verified. Please sign in again or request a new password-reset link.');
  }, []);
  const signUp = mode === 'signUp';
  function switchMode() {
    setMode(signUp ? 'signIn' : 'signUp'); setError(''); setNotice(''); setPassword('');
    window.history.replaceState(null, '', signUp ? '/login' : '/login?mode=signup');
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const db = clientSupabase();
      const result = signUp
        ? await db.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/api/auth/callback`, data: { full_name: name.trim() } } })
        : await db.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (signUp && !result.data.session) { setNotice('Check your inbox for a confirmation link. After confirming your email, you can sign in.'); setPassword(''); return; }
      router.replace('/dashboard'); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  }
  async function googleSignIn() {
    setBusy(true); setError('');
    try {
      const { error } = await clientSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/api/auth/callback` } });
      if (error) throw error;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to connect to Google sign-in.'); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow={signUp ? 'Your next chapter' : 'Welcome back'} title={signUp ? 'Create your account' : 'Your plan awaits.'} description={signUp ? 'Start with a few details. You can build your financial plan at your own pace.' : 'Sign in to see your progress and take your next step.'}>
    <button type="button" onClick={googleSignIn} disabled={busy} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold hover:border-blue-300 disabled:opacity-60"><span aria-hidden="true" className="font-bold text-blue-600">G</span>Continue with Google</button>
    <div className="my-6 flex items-center gap-4 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or continue with email<span className="h-px flex-1 bg-slate-200" /></div>
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5">
        {signUp && <label className="block text-sm font-medium">Your name<input name="name" autoComplete="name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)} className={authInput} placeholder="How should we greet you?" /></label>}
        <label className="block text-sm font-medium">Email address<input name="email" autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className={authInput} placeholder="you@example.com" /></label>
        <div><div className="flex items-center justify-between text-sm"><label htmlFor="password" className="font-medium">Password</label>{!signUp && <Link href="/forgot-password" className="text-xs font-semibold text-blue-600 hover:underline">Forgot password?</Link>}</div><div className="relative"><input id="password" name="password" autoComplete={signUp ? 'new-password' : 'current-password'} type={showPassword ? 'text' : 'password'} required minLength={signUp ? 8 : undefined} value={password} onChange={e=>setPassword(e.target.value)} className={authInput + ' pr-16'} placeholder={signUp ? 'At least 8 characters' : 'Enter your password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)} className="absolute right-4 top-0 h-12 text-xs font-semibold text-slate-500">{showPassword ? 'Hide' : 'Show'}</button></div></div>
      </fieldset>
      {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm leading-6 text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm leading-6 text-emerald-700">{notice}</p>}
      <button disabled={busy} type="submit" className={authButton}>{busy ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'}{!busy && <span aria-hidden="true" className="ml-3">→</span>}</button>
    </form>
    <p className="mt-7 text-center text-sm text-slate-500">{signUp ? 'Already have an account? ' : 'New to Investment Planner? '}<button type="button" disabled={busy} onClick={switchMode} className="font-semibold text-blue-600 hover:underline">{signUp ? 'Sign in' : 'Create an account'}</button></p>
  </AuthFrame>;
}
