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
}

export interface WithdrawalRow {
  id: number;
  account: string;
  amount_cad: number;
  withdrawn_on: string;
  room_restored_in: number | null;
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

/** Service-role only: API route adds tickers discovered via Yahoo search. */
export async function upsertInstrument(
  client: SupabaseClient,
  ticker: string,
  name: string,
  currency: string
): Promise<InstrumentRow> {
  const { data, error } = await client
    .from('instruments')
    .upsert({ ticker, name, currency }, { onConflict: 'ticker' })
    .select('*')
    .single();
  if (error) throw error;
  return data as InstrumentRow;
}

// ── Holdings ──────────────────────────────────────────────────────────

export async function getHoldings(client: SupabaseClient, userId: string): Promise<HoldingWithInstrument[]> {
  const { data, error } = await client
    .from('holdings')
    .select('*, instruments(ticker, name, currency)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((h: any) => ({
    id: h.id,
    instrument_id: h.instrument_id,
    account: h.account,
    units: h.units,
    balance_native: h.balance_native,
    fx_provider: h.fx_provider,
    fx_rate: h.fx_rate,
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
  const { data, error } = await client.from('withdrawals').insert({ user_id: userId, ...w }).select('*').single();
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
