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
  const { data: created, error: insErr } = await client.from('profiles').insert({ id: userId }).select('*').single();
  if (insErr) throw insErr;
  return created as Profile;
}

export async function saveProfile(
  client: SupabaseClient,
  userId: string,
  p: Omit<Profile, 'id'>
): Promise<void> {
  const { error } = await client.from('profiles').upsert({ id: userId, ...p }, { onConflict: 'id' });
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
  const { error } = await client.from('account_alloc').delete().eq('user_id', userId);
  if (error) throw error;
  if (rows.length === 0) return;
  const { error: insErr } = await client
    .from('account_alloc')
    .insert(rows.map((r) => ({ user_id: userId, ...r })));
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
  const { error } = await client.from('instrument_alloc').delete().eq('user_id', userId);
  if (error) throw error;
  if (rows.length === 0) return;
  const { error: insErr } = await client
    .from('instrument_alloc')
    .insert(rows.map((r) => ({ user_id: userId, ...r })));
  if (insErr) throw insErr;
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
): Promise<void> {
  const { error } = await client.from('contributions').insert({ user_id: userId, ...c });
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
): Promise<void> {
  const { error } = await client.from('withdrawals').insert({ user_id: userId, ...w });
  if (error) throw error;
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
