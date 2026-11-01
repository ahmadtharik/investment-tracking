import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  monthly_income: number;
  monthly_expenses: number;
  emergency_fund: number;
  emergency_target: number;
  tfsa_room: number;
  rrsp_room: number;
}

export interface AccountAllocRow {
  account: 'TFSA' | 'RRSP' | 'CASH';
  pct: number;
}

export interface EtfAllocRow {
  account: 'TFSA' | 'RRSP';
  instrument_id: number;
  pct: number;
}

export interface InstrumentRow {
  id: number;
  ticker: string;
  name: string;
  currency: string;
  asset_class: string;
}

export interface HoldingRow {
  id: number;
  instrument_id: number;
  account: string;
  units: number;
  balance_native: number;
  fx_provider: string;
  fx_rate: number;
  cost_cad?: number | null;
}

export interface HoldingWithInstrument extends HoldingRow {
  ticker: string;
  name: string;
  currency: string;
}

export interface ContributionRow {
  id: number;
  account: string;
  instrument_id: number | null;
  amount_cad: number;
  fx_provider: string | null;
  fx_rate: number | null;
  fx_cost_cad: number | null;
  amount_native: number | null;
  contributed_on: string;
  units?: number | null;
  source?: 'manual' | 'auto' | 'early';
  cycle_due_on?: string | null;
}

export interface ScheduleRow {
  day_of_month: number;
  next_due: string;
  paused: boolean;
}

export interface CycleRow {
  id: number;
  due_on: string;
  status: 'auto' | 'early' | 'manual' | 'skipped';
  note: string | null;
  reviewed: boolean;
}

/** One contribution as sent to the database functions in migration 0003. */
export interface ContributionLine {
  account: string;
  instrument_id: number | null;
  amount_cad: number;
  contributed_on: string;
  units?: number | null;
  price_native?: number | null;
  amount_native?: number | null;
  fx_rate?: number | null;
  allow_over?: boolean;
}

export interface WithdrawalRow {
  id: number;
  account: string;
  amount_cad: number;
  withdrawn_on: string;
  room_restored_in: number | null;
  restored?: boolean;
}

export interface RoomEventRow {
  id: number;
  account: 'TFSA' | 'RRSP';
  kind: 'new_limit' | 'restored' | 'adjustment';
  amount_cad: number;
  effective_on: string;
  note: string | null;
}

export interface FxPrefRow {
  ticker: string;
  provider: 'TD' | 'WEALTHSIMPLE' | 'CUSTOM';
  custom_rate: number | null;
}

// ── Profiles ──────────────────────────────────────────────────────────

export async function getOrCreateProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;

  // Never infer personal contribution eligibility from a lifetime maximum.
  // New clients must enter their verified available room.
  // Ignore a concurrent initial insert, then read the canonical profile row.
  const { error: upsertError } = await client
    .from('profiles')
    .upsert({ id: userId, tfsa_room: 0, rrsp_room: 0 }, { onConflict: 'id', ignoreDuplicates: true });
  if (upsertError) throw upsertError;
  const { data: created, error: createdError } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (createdError) throw createdError;
  return created as Profile;
}

export async function saveProfile(
  client: SupabaseClient,
  userId: string,
  p: Partial<Omit<Profile, 'id'>>
): Promise<void> {
  const { error } = await client.from('profiles').update(p).eq('id', userId);
  if (error) throw error;
}

// ── Allocations ───────────────────────────────────────────────────────

export async function getAccountAllocations(client: SupabaseClient, userId: string): Promise<AccountAllocRow[]> {
  const { data, error } = await client
    .from('account_alloc')
    .select('account, pct')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as AccountAllocRow[];
}

export async function saveAccountAllocations(
  client: SupabaseClient,
  userId: string,
  rows: AccountAllocRow[]
): Promise<void> {
  if (rows.length !== 3 || new Set(rows.map(r => r.account)).size !== 3 || rows.some(r => !Number.isFinite(r.pct) || r.pct < 0 || r.pct > 1) || Math.abs(rows.reduce((sum, r) => sum + r.pct, 0) - 1) > 0.0001) throw new Error('Provide TFSA, RRSP and Cash allocations totaling 100%.');
  const { error: insErr } = await client
    .from('account_alloc')
    .upsert(rows.map((r) => ({ user_id: userId, ...r })), { onConflict: 'user_id,account' });
  if (insErr) throw insErr;
}

export async function getEtfAllocations(client: SupabaseClient, userId: string): Promise<EtfAllocRow[]> {
  const { data, error } = await client
    .from('instrument_alloc')
    .select('account, instrument_id, pct')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as EtfAllocRow[];
}

export async function saveEtfAllocations(
  client: SupabaseClient,
  userId: string,
  rows: EtfAllocRow[]
): Promise<void> {
  const previous = await getEtfAllocations(client, userId);
  if (rows.length > 0) {
    const { error } = await client.from('instrument_alloc').upsert(rows.map(r => ({ user_id: userId, ...r })), { onConflict: 'user_id,account,instrument_id' });
    if (error) throw error;
  }
  for (const old of previous.filter(p => !rows.some(r => r.account === p.account && r.instrument_id === p.instrument_id))) {
    const { error } = await client.from('instrument_alloc').delete().eq('user_id', userId).eq('account', old.account).eq('instrument_id', old.instrument_id);
    if (error) throw error;
  }
}

// ── Instruments ───────────────────────────────────────────────────────

export async function listInstruments(client: SupabaseClient): Promise<InstrumentRow[]> {
  const { data, error } = await client.from('instruments').select('*').order('ticker');
  if (error) throw error;
  return (data ?? []) as InstrumentRow[];
}

/**
 * Service-role only: API route adds tickers discovered via Yahoo search. The list
 * is shared, so an existing ticker is returned as is and never renamed by a user.
 */
export async function upsertInstrument(
  client: SupabaseClient,
  ticker: string,
  name: string,
  currency: string
): Promise<InstrumentRow> {
  const { error: insertError } = await client
    .from('instruments')
    .upsert({ ticker, name, currency }, { onConflict: 'ticker', ignoreDuplicates: true });
  if (insertError) throw insertError;
  const { data, error } = await client.from('instruments').select('*').eq('ticker', ticker).single();
  if (error) throw error;
  return data as InstrumentRow;
}

// ── Holdings ──────────────────────────────────────────────────────────

export async function getHoldings(client: SupabaseClient, userId: string): Promise<HoldingWithInstrument[]> {
  const { data, error } = await client
    .from('holdings')
    .select('*, instruments(ticker, name, currency)')
    .eq('user_id', userId)
    .order('id');
  if (error) throw error;
  return (data ?? []).map((h: any) => ({
    id: h.id,
    instrument_id: h.instrument_id,
    account: h.account,
    units: h.units,
    balance_native: h.balance_native,
    fx_provider: h.fx_provider,
    fx_rate: h.fx_rate,
    cost_cad: h.cost_cad,
    ticker: h.instruments?.ticker,
    name: h.instruments?.name,
    currency: h.instruments?.currency,
  })) as HoldingWithInstrument[];
}

export async function upsertHolding(
  client: SupabaseClient,
  userId: string,
  h: Omit<HoldingRow, 'id'> & { id?: number }
): Promise<void> {
  const { id, ...fields } = h;
  if (id != null) {
    const { error } = await client.from('holdings').update(fields).eq('id', id).eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await client.from('holdings').insert({ user_id: userId, ...fields });
    if (error) throw error;
  }
}

export async function deleteHolding(client: SupabaseClient, userId: string, id: number): Promise<void> {
  const { error } = await client.from('holdings').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ── Contributions / withdrawals ───────────────────────────────────────

export async function getContributions(
  client: SupabaseClient,
  userId: string,
  from?: string
): Promise<ContributionRow[]> {
  let q = client.from('contributions').select('*').eq('user_id', userId);
  if (from) q = q.gte('contributed_on', from);
  const { data, error } = await q.order('contributed_on', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContributionRow[];
}

export async function addContribution(
  client: SupabaseClient,
  userId: string,
  c: Omit<ContributionRow, 'id'>
): Promise<{ remainingRoom?: number }> {
  if (!Number.isFinite(c.amount_cad) || c.amount_cad <= 0 || Math.abs(c.amount_cad * 100 - Math.round(c.amount_cad * 100)) > 0.000001) throw new Error('Enter a positive CAD amount with at most two decimal places.');
  const atomic = await client.rpc('record_contribution', { p_contribution: c });
  if (!atomic.error) return atomic.data as { remainingRoom?: number };
  // Backward compatibility until migration 0002 is deployed. Never retry a
  // failed transaction through the legacy path; only a missing function permits it.
  if (atomic.error.code !== 'PGRST202') throw atomic.error;
  // The saved room fields represent *currently available* registered-account
  // room. Consume it when the corresponding real deposit is recorded. Cash is
  // deliberately excluded because it has no contribution limit.
  const roomColumn = c.account === 'TFSA' ? 'tfsa_room' : c.account === 'RRSP' ? 'rrsp_room' : null;
  let previousRoom: number | undefined;
  let remainingRoom: number | undefined;

  if (roomColumn) {
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select(roomColumn)
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    previousRoom = Math.max(0, Number((profile as Record<string, unknown>)[roomColumn]) || 0);
    if (c.amount_cad > previousRoom) {
      throw new Error(`This ${c.account} contribution exceeds the available room of ${previousRoom.toFixed(2)} CAD.`);
    }

    remainingRoom = Math.round((previousRoom - c.amount_cad) * 100) / 100;
    // Compare against the value we just read so a second browser tab cannot
    // silently overwrite a more recent contribution-room update.
    const { data: updatedProfile, error: roomError } = await client
      .from('profiles')
      .update({ [roomColumn]: remainingRoom })
      .eq('id', userId)
      .eq(roomColumn, previousRoom)
      .select(roomColumn)
      .maybeSingle();
    if (roomError) throw roomError;
    if (!updatedProfile) throw new Error('Contribution room changed. Please try again.');
  }

  const { error } = await client.from('contributions').insert({ user_id: userId, ...c });
  if (error) {
    // Best-effort compensation: only restore the value when nothing else has
    // changed it after our conditional update.
    if (roomColumn && previousRoom !== undefined && remainingRoom !== undefined) {
      await client.from('profiles').update({ [roomColumn]: previousRoom }).eq('id', userId).eq(roomColumn, remainingRoom);
    }
    throw error;
  }

  return roomColumn ? { remainingRoom } : {};
}

// ── Contribution schedule ─────────────────────────────────────────────

/** Null when no schedule is set, or until migration 0003 is applied. */
export async function getSchedule(client: SupabaseClient, userId: string): Promise<ScheduleRow | null> {
  const { data, error } = await client.from('contribution_schedules').select('day_of_month, next_due, paused').eq('user_id', userId).maybeSingle();
  if (error) return null;
  return data as ScheduleRow | null;
}

export async function saveSchedule(client: SupabaseClient, userId: string, schedule: ScheduleRow): Promise<void> {
  const { error } = await client.from('contribution_schedules').upsert({ user_id: userId, ...schedule }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function deleteSchedule(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from('contribution_schedules').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function getCycles(client: SupabaseClient, userId: string, limit = 12): Promise<CycleRow[]> {
  const { data, error } = await client.from('contribution_cycles').select('id, due_on, status, note, reviewed').eq('user_id', userId).order('due_on', { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []) as CycleRow[];
}

export async function markCyclesReviewed(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from('contribution_cycles').update({ reviewed: true }).eq('user_id', userId).eq('reviewed', false);
  if (error) throw error;
}

export async function resolveCycle(
  client: SupabaseClient,
  c: { due: string; status: CycleRow['status']; lines: ContributionLine[]; nextDue: string; note?: string }
): Promise<{ applied: boolean; total?: number }> {
  const { data, error } = await client.rpc('resolve_cycle', { p_due: c.due, p_status: c.status, p_lines: c.lines, p_next_due: c.nextDue, p_note: c.note ?? null });
  if (error) throw error;
  return data as { applied: boolean; total?: number };
}

export async function undoCycle(client: SupabaseClient, due: string): Promise<void> {
  const { error } = await client.rpc('undo_cycle', { p_due: due });
  if (error) throw error;
}

export async function recordPurchase(client: SupabaseClient, userId: string, line: ContributionLine): Promise<void> {
  const { error } = await client.rpc('record_purchase', { p_line: line });
  if (!error) return;
  // Until migration 0003 is deployed, deposits still record, without updating a holding.
  if (error.code !== 'PGRST202') throw error;
  await addContribution(client, userId, { account: line.account, instrument_id: line.instrument_id, amount_cad: line.amount_cad, fx_provider: null, fx_rate: line.fx_rate ?? null, fx_cost_cad: null, amount_native: line.amount_native ?? null, contributed_on: line.contributed_on });
}

export async function updateContribution(client: SupabaseClient, id: number, line: ContributionLine): Promise<void> {
  const { error } = await client.rpc('update_contribution', { p_id: id, p_line: line });
  if (error) throw error;
}

export async function deleteContribution(client: SupabaseClient, id: number): Promise<void> {
  const { error } = await client.rpc('delete_contribution', { p_id: id });
  if (error) throw error;
}

// ── Portfolio history ─────────────────────────────────────────────────

/** Best effort: a missed day only leaves a gap in the chart. */
export async function saveSnapshot(client: SupabaseClient, userId: string, date: string, value: number): Promise<void> {
  await client.from('portfolio_snapshots').upsert({ user_id: userId, snapshot_on: date, value_cad: Math.round(value * 100) / 100 }, { onConflict: 'user_id,snapshot_on' });
}

export async function getSnapshots(client: SupabaseClient, userId: string): Promise<{ snapshot_on: string; value_cad: number }[]> {
  const { data, error } = await client.from('portfolio_snapshots').select('snapshot_on, value_cad').eq('user_id', userId).order('snapshot_on');
  if (error) return [];
  return data ?? [];
}

// ── Contribution room ─────────────────────────────────────────────────

export async function getRoomEvents(client: SupabaseClient, userId: string): Promise<RoomEventRow[]> {
  const { data, error } = await client.from('room_events').select('id, account, kind, amount_cad, effective_on, note').eq('user_id', userId).order('id', { ascending: false }).limit(50);
  if (error) return [];
  return (data ?? []) as RoomEventRow[];
}

export async function addRoom(client: SupabaseClient, account: 'TFSA' | 'RRSP', amount: number, kind: RoomEventRow['kind'], note?: string): Promise<void> {
  const { error } = await client.rpc('add_room', { p_account: account, p_amount: amount, p_kind: kind, p_note: note ?? null });
  if (error) throw error;
}

export async function setRoom(client: SupabaseClient, tfsa: number, rrsp: number): Promise<void> {
  const { error } = await client.rpc('set_room', { p_tfsa: tfsa, p_rrsp: rrsp });
  if (error) throw error;
}

export async function getWithdrawals(client: SupabaseClient, userId: string): Promise<WithdrawalRow[]> {
  const { data, error } = await client
    .from('withdrawals')
    .select('*')
    .eq('user_id', userId)
    .order('withdrawn_on', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WithdrawalRow[];
}

export async function addWithdrawal(
  client: SupabaseClient,
  userId: string,
  w: Omit<WithdrawalRow, 'id'>
): Promise<WithdrawalRow> {
  // A restoration year already here is assumed to be in the room the user entered.
  const restored = w.room_restored_in != null && w.room_restored_in <= new Date().getFullYear();
  const { data, error } = await client.from('withdrawals').insert({ user_id: userId, restored, ...w }).select('*').single();
  if (error) throw error;
  return data as WithdrawalRow;
}

export async function deleteWithdrawal(client: SupabaseClient, userId: string, id: number): Promise<void> {
  const { error } = await client.from('withdrawals').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ── FX preferences ────────────────────────────────────────────────────

export async function getFxPrefs(client: SupabaseClient, userId: string): Promise<FxPrefRow[]> {
  const { data, error } = await client
    .from('fx_prefs')
    .select('ticker, provider, custom_rate')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as FxPrefRow[];
}

export async function saveFxPrefs(
  client: SupabaseClient,
  userId: string,
  rows: FxPrefRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client
    .from('fx_prefs')
    .upsert(rows.map((r) => ({ user_id: userId, ...r })), { onConflict: 'user_id,ticker' });
  if (error) throw error;
}
