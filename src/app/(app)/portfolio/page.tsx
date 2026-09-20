import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getContributions, getHoldings, listInstruments } from '@/lib/db/queries';
import { getQuotes } from '@/lib/market/yahoo';
import { PortfolioClient } from '@/components/portfolio-client';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  const [holdings, instruments, contributions] = await Promise.all([getHoldings(db, user.id), listInstruments(db), getContributions(db, user.id)]);
  let quotes: Record<string, { price: number; currency: string; asOf: string }> = {};
  try { quotes = await getQuotes([...new Set(holdings.map((h) => h.ticker))]); } catch { /* render without quotes */ }
  return <PortfolioClient userId={user.id} instruments={instruments} initialHoldings={holdings} initialQuotes={quotes} contributions={contributions.map((item) => ({ id: item.id, account: item.account, amount: item.amount_cad, date: item.contributed_on }))} />;
}
