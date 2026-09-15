import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getHoldings, listInstruments } from '@/lib/db/queries';
import { getQuotes } from '@/lib/market/yahoo';
import { PortfolioClient } from '@/components/portfolio-client';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [holdings, instruments] = await Promise.all([getHoldings(db, user.id), listInstruments(db)]);
  let quotes: Record<string, { price: number; currency: string; asOf: string }> = {};
  try { quotes = await getQuotes([...new Set(holdings.map((h) => h.ticker))]); } catch { /* render without quotes */ }
  return <div className="mx-auto max-w-6xl px-4 py-8"><h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Your holdings, live prices, and current allocation.</p><p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Quotes are best-effort market data, not guaranteed valuations. Check your brokerage records.</p><PortfolioClient userId={user.id} instruments={instruments} initialHoldings={holdings} initialQuotes={quotes} /></div>;
}
