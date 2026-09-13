import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getAccountAllocations, getEtfAllocations, getFxPrefs, getOrCreateProfile, listInstruments } from '@/lib/db/queries';
import { computePlan } from '@/lib/engine/plan';
import { toPlanInput } from '@/lib/plan-input';
import { getQuotes } from '@/lib/market/yahoo';
import { FxForm } from '@/components/forms/fx-form';

export const dynamic = 'force-dynamic';

export default async function FxPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [profile, accountAlloc, etfAlloc, instruments, prefs] = await Promise.all([
    getOrCreateProfile(db, user.id), getAccountAllocations(db, user.id), getEtfAllocations(db, user.id), listInstruments(db), getFxPrefs(db, user.id),
  ]);
  let midRate = 1.35; let asOf: string | undefined;
  try { const quote = await getQuotes(['CAD=X']); if (quote['CAD=X']) { midRate = quote['CAD=X'].price; asOf = quote['CAD=X'].asOf; } } catch { /* fallback keeps the calculator usable */ }
  const plan = computePlan(toPlanInput(profile, accountAlloc, etfAlloc, instruments, prefs));
  const usdPurchases = plan.purchases.filter((p) => p.instrument.currency === 'USD');
  const initialAmount = usdPurchases.reduce((sum, p) => sum + p.cadAmount, 0) || 550;
  const usdTickers = [...new Set(usdPurchases.map((p) => p.instrument.ticker))];
  const pref = usdTickers.map((t) => prefs.find((p) => p.ticker === t)).find(Boolean) ?? prefs.find((p) => p.ticker === 'VTI');
  const initialProvider = pref?.provider ?? 'TD';
  const initialRate = pref?.custom_rate ?? null;
  return <div className="mx-auto max-w-6xl px-4 py-8"><h1 className="text-2xl font-semibold tracking-tight">FX Calculator</h1><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">See what CAD-to-USD conversion costs across your available providers.</p><div className="mt-6"><FxForm userId={user.id} midRate={midRate} asOf={asOf} initialAmount={initialAmount} initialProvider={initialProvider} initialRate={initialRate} usdTickers={usdTickers} /></div></div>;
}
