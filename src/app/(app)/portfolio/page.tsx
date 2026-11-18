import { authGuard } from '@/lib/supabase/middleware';
import { settleDueCycles } from '@/lib/schedule/settle';
import { serverSupabase } from '@/lib/supabase/server';
import { getContributions, getHoldings, getSnapshots, listInstruments, saveSnapshot } from '@/lib/db/queries';
import { getQuotes } from '@/lib/market/yahoo';
import { canSaveSnapshot, holdingValueCad, USD_CAD_TICKER, valuationTickers } from '@/lib/valuation';
import { todayInToronto } from '@/lib/engine/schedule';
import { PortfolioClient } from '@/components/portfolio-client';
import { PriceNotice } from '@/components/price-notice';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const user = await authGuard();
  const db = await serverSupabase();
  await settleDueCycles(db, user.id);
  const [holdings, instruments, contributions] = await Promise.all([getHoldings(db, user.id), listInstruments(db), getContributions(db, user.id)]);
  let quotes: Record<string, { price: number; currency: string; asOf: string }> = {};
  try { quotes = await getQuotes([...new Set([...valuationTickers(holdings), USD_CAD_TICKER])]); } catch { /* render without quotes */ }
  const pricesLive = canSaveSnapshot(holdings, quotes);
  if (holdings.length && pricesLive) await saveSnapshot(db, user.id, todayInToronto(), holdings.reduce((sum, holding) => sum + holdingValueCad(holding, quotes), 0));
  const snapshots = await getSnapshots(db, user.id);
  return <>{holdings.length > 0 && !pricesLive && <PriceNotice />}<PortfolioClient snapshots={snapshots} userId={user.id} instruments={instruments} initialHoldings={holdings} initialQuotes={quotes} contributions={contributions.map((item) => ({ id: item.id, account: item.account, amount: item.amount_cad, date: item.contributed_on }))} /></>;
}
