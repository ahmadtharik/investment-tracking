import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccountAllocations, getEtfAllocations, getFxPrefs, getOrCreateProfile, getSchedule, listInstruments, resolveCycle, type ContributionLine } from '@/lib/db/queries';
import { buildInstalment, dueAfter, todayInToronto, type InstalmentLine } from '@/lib/engine/schedule';
import { getHistory, getQuotes, type QuotePoint } from '@/lib/market/yahoo';
import { toPlanInput } from '@/lib/plan-input';

const MAX_CATCH_UP = 24;

type Resolver = typeof resolveCycle;
/** Monthly history per ticker, shared across one catch-up so each ticker is fetched once. */
type HistoryCache = Map<string, Promise<QuotePoint[]>>;
const LIVE_QUOTE_DAYS = 5;

export async function currentInstalment(db: SupabaseClient, userId: string): Promise<InstalmentLine[]> {
  const [profile, accountAlloc, etfAlloc, instruments, fxPrefs] = await Promise.all([
    getOrCreateProfile(db, userId), getAccountAllocations(db, userId), getEtfAllocations(db, userId), listInstruments(db), getFxPrefs(db, userId),
  ]);
  return buildInstalment(toPlanInput(profile, accountAlloc, etfAlloc, instruments, fxPrefs));
}

/** Live quote for a recent date, otherwise that month's close. Null leaves the units for the user to review. */
async function priceOn(ticker: string, date: string, today: string, history: HistoryCache): Promise<number | null> {
  try {
    if ((Date.parse(today) - Date.parse(date)) / 86_400_000 <= LIVE_QUOTE_DAYS) return (await getQuotes([ticker]))[ticker]?.price ?? null;
    if (!history.has(ticker)) history.set(ticker, getHistory(ticker, '2y'));
    const points = await history.get(ticker)!;
    return points.find((point) => point.date.slice(0, 7) === date.slice(0, 7))?.close ?? null;
  } catch {
    return null;
  }
}

async function usdRate(): Promise<number | null> {
  try { return (await getQuotes(['CAD=X']))['CAD=X']?.price ?? null; } catch { return null; }
}

/** Adds units and native amounts at the given date's price. */
export async function pricedLines(lines: InstalmentLine[], date: string, today: string, history: HistoryCache = new Map()): Promise<ContributionLine[]> {
  const needsUsd = lines.some((line) => line.currency === 'USD');
  const fx = needsUsd ? await usdRate() : null;
  return Promise.all(lines.map(async (line) => {
    const base = { account: line.account, instrument_id: line.instrumentId, amount_cad: line.amountCad, contributed_on: date };
    if (!line.ticker) return base;
    const price = await priceOn(line.ticker, date, today, history);
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
 * Returns false when something failed, so the daily job can report it.
 */
export async function settleDueCycles(db: SupabaseClient, userId: string, resolve: Resolver = resolveCycle): Promise<boolean> {
  try {
    if (resolve === resolveCycle) await db.rpc('apply_room_restorations');
    const schedule = await getSchedule(db, userId);
    if (!schedule || schedule.paused) return true;
    const today = todayInToronto();
    let due = schedule.next_due;
    if (due > today) return true;
    const instalment = await currentInstalment(db, userId);
    const history: HistoryCache = new Map();
    for (let i = 0; i < MAX_CATCH_UP && due <= today; i += 1) {
      const next = dueAfter(due, schedule.day_of_month);
      if (instalment.length === 0) {
        await resolve(db, { due, status: 'skipped', lines: [], nextDue: next, note: 'Nothing recorded: no monthly surplus' });
      } else {
        await resolve(db, { due, status: 'auto', lines: await pricedLines(instalment, due, today, history), nextDue: next });
      }
      due = next;
    }
    return true;
  } catch (error) {
    console.error('Could not record due contributions:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * The daily job: records due instalments and restored room for every user, so
 * nothing depends on anyone opening the app. Stops when the time budget runs out;
 * the rest are handled by the next run or the user's next page load.
 */
export async function settleAllUsers(service: SupabaseClient, budgetMs: number): Promise<{ settled: number; failed: number; remaining: number }> {
  const started = Date.now();
  const year = Number(todayInToronto().slice(0, 4));
  const { data: restorations, error: restoreError } = await service.from('withdrawals').select('user_id').eq('restored', false).lte('room_restored_in', year);
  if (restoreError) throw restoreError;
  let failed = 0;
  for (const userId of new Set((restorations ?? []).map((row) => row.user_id as string))) {
    const { error } = await service.rpc('apply_room_restorations_as', { p_user: userId });
    if (error) { console.error('Could not restore room:', error.message); failed += 1; }
  }
  const { data, error } = await service.from('contribution_schedules').select('user_id').eq('paused', false).lte('next_due', todayInToronto()).order('next_due');
  if (error) throw error;
  const users = (data ?? []).map((row) => row.user_id as string);
  let settled = 0;
  for (const userId of users) {
    if (Date.now() - started > budgetMs) break;
    const ok = await settleDueCycles(service, userId, async (client, c) => {
      const { data: result, error: rpcError } = await client.rpc('resolve_cycle_as', { p_user: userId, p_due: c.due, p_status: c.status, p_lines: c.lines, p_next_due: c.nextDue, p_note: c.note ?? null });
      if (rpcError) throw rpcError;
      return result as { applied: boolean; total?: number };
    });
    if (ok) settled += 1; else failed += 1;
  }
  return { settled, failed, remaining: users.length - settled - failed };
}
