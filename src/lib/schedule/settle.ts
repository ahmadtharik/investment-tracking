import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccountAllocations, getEtfAllocations, getFxPrefs, getOrCreateProfile, getSchedule, listInstruments, resolveCycle, type ContributionLine } from '@/lib/db/queries';
import { buildInstalment, dueAfter, todayInToronto, type InstalmentLine } from '@/lib/engine/schedule';
import { getHistory, getQuotes } from '@/lib/market/yahoo';
import { toPlanInput } from '@/lib/plan-input';

const MAX_CATCH_UP = 24;
const LIVE_QUOTE_DAYS = 5;

export async function currentInstalment(db: SupabaseClient, userId: string): Promise<InstalmentLine[]> {
  const [profile, accountAlloc, etfAlloc, instruments, fxPrefs] = await Promise.all([
    getOrCreateProfile(db, userId), getAccountAllocations(db, userId), getEtfAllocations(db, userId), listInstruments(db), getFxPrefs(db, userId),
  ]);
  return buildInstalment(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
}

/** Live quote for a recent date, otherwise that month's close. Null leaves the units for the user to review. */
async function priceOn(ticker: string, date: string, today: string): Promise<number | null> {
  try {
    if ((Date.parse(today) - Date.parse(date)) / 86_400_000 <= LIVE_QUOTE_DAYS) return (await getQuotes([ticker]))[ticker]?.price ?? null;
    const points = await getHistory(ticker, '2y');
    return points.find((point) => point.date.slice(0, 7) === date.slice(0, 7))?.close ?? null;
  } catch {
    return null;
  }
}

async function usdRate(): Promise<number | null> {
  try { return (await getQuotes(['CAD=X']))['CAD=X']?.price ?? null; } catch { return null; }
}

/** Adds units and native amounts at the given date's price. */
export async function pricedLines(lines: InstalmentLine[], date: string, today: string): Promise<ContributionLine[]> {
  const needsUsd = lines.some((line) => line.currency === 'USD');
  const fx = needsUsd ? await usdRate() : null;
  return Promise.all(lines.map(async (line) => {
    const base = { account: line.account, instrument_id: line.instrumentId, amount_cad: line.amountCad, contributed_on: date };
    if (!line.ticker) return base;
    const price = await priceOn(line.ticker, date, today);
    const rate = line.currency === 'USD' ? fx : 1;
    if (!price || !rate) return base;
    const native = line.amountCad / rate;
    return { ...base, price_native: price, amount_native: Math.round(native * 100) / 100, fx_rate: rate, units: Math.round((native / price) * 10000) / 10000 };
  }));
}

/**
 * Records every instalment that has come due, including ones missed while the
 * user was away. Safe to call on any page load: resolve_cycle handles each
 * due date once. Never throws, so a market or database problem can't break a page.
 */
export async function settleDueCycles(db: SupabaseClient, userId: string): Promise<void> {
  try {
    await db.rpc('apply_room_restorations');
    const schedule = await getSchedule(db, userId);
    if (!schedule || schedule.paused) return;
    const today = todayInToronto();
    let due = schedule.next_due;
    if (due > today) return;
    const instalment = await currentInstalment(db, userId);
    for (let i = 0; i < MAX_CATCH_UP && due <= today; i += 1) {
      const next = dueAfter(due, schedule.day_of_month);
      if (instalment.length === 0) {
        await resolveCycle(db, { due, status: 'skipped', lines: [], nextDue: next, note: 'Nothing recorded: no monthly surplus' });
      } else {
        await resolveCycle(db, { due, status: 'auto', lines: await pricedLines(instalment, due, today), nextDue: next });
      }
      due = next;
    }
  } catch (error) {
    console.error('Could not record due contributions:', error instanceof Error ? error.message : error);
  }
}
