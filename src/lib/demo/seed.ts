import type { SupabaseClient } from '@supabase/supabase-js';
import { nextDueFrom } from '@/lib/engine/schedule';

const DAY_OF_MONTH = 15;

/** Whether this user is the shared demo account, which visitors can sign in to. */
export function isDemoUser(userId: string | undefined): boolean {
  return Boolean(userId && process.env.DEMO_USER_ID && userId === process.env.DEMO_USER_ID);
}

const shiftMonths = (date: string, months: number) => {
  const [year, month] = date.split('-').map(Number);
  return `${new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7)}-${String(DAY_OF_MONTH).padStart(2, '0')}`;
};

/** Fictional data, positioned relative to today so the account always looks current. */
export function buildDemoData(today: string, ids: { equity: number; usd: number }) {
  const nextDue = nextDueFrom(today, DAY_OF_MONTH);
  const dues = [6, 5, 4, 3, 2, 1].map((months) => shiftMonths(nextDue, -months));
  const contributions = dues.flatMap((due) => [
    { account: 'TFSA', instrument_id: ids.equity, amount_cad: 900, contributed_on: due, units: 20, amount_native: 900, price_native: 45, fx_rate: 1, source: 'auto', cycle_due_on: due },
    { account: 'RRSP', instrument_id: ids.usd, amount_cad: 450, contributed_on: due, units: 0.9, amount_native: 321.43, price_native: 357.14, fx_rate: 1.4, source: 'auto', cycle_due_on: due },
    { account: 'CASH', instrument_id: null, amount_cad: 150, contributed_on: due, units: null, amount_native: null, price_native: null, fx_rate: null, source: 'auto', cycle_due_on: due },
  ]);
  const start = Date.parse(today);
  const snapshots = Array.from({ length: 90 }, (_, index) => {
    const daysAgo = 89 - index;
    const wave = Math.sin(index / 6) * 180;
    return { snapshot_on: new Date(start - daysAgo * 86_400_000).toISOString().slice(0, 10), value_cad: Math.round(26000 + index * 45 + wave) };
  });
  return {
    profile: { monthly_income: 6500, monthly_expenses: 5000, emergency_fund: 12000, emergency_target: 15000, tfsa_room: 22600, rrsp_room: 18300 },
    accountAlloc: [{ account: 'TFSA', pct: 0.6 }, { account: 'RRSP', pct: 0.3 }, { account: 'CASH', pct: 0.1 }],
    instrumentAlloc: [{ account: 'TFSA', instrument_id: ids.equity, pct: 1 }, { account: 'RRSP', instrument_id: ids.usd, pct: 1 }],
    holdings: [
      { instrument_id: ids.equity, account: 'TFSA', units: 420, balance_native: 18900, fx_rate: 1, cost_cad: 17200 },
      { instrument_id: ids.usd, account: 'RRSP', units: 22, balance_native: 7800, fx_rate: 1.4, cost_cad: 9400 },
    ],
    contributions,
    cycles: dues.map((due) => ({ due_on: due, status: 'auto', reviewed: true })),
    schedule: { day_of_month: DAY_OF_MONTH, next_due: nextDue, paused: false },
    snapshots,
  };
}

/** Puts the demo account back to its starting state. Only ever acts on DEMO_USER_ID. */
export async function resetDemoAccount(service: SupabaseClient, today: string): Promise<boolean> {
  const userId = process.env.DEMO_USER_ID;
  if (!userId) return false;
  const { data: instruments, error } = await service.from('instruments').select('id, ticker').in('ticker', ['XEQT.TO', 'VTI']);
  if (error) throw error;
  const idOf = (ticker: string) => {
    const id = instruments?.find((item) => item.ticker === ticker)?.id;
    if (!id) throw new Error(`Demo data needs ${ticker}`);
    return id as number;
  };
  const data = buildDemoData(today, { equity: idOf('XEQT.TO'), usd: idOf('VTI') });
  const { error: resetError } = await service.rpc('reset_demo_account', { p_user: userId, p_data: data });
  if (resetError) throw new Error(resetError.message);
  // Signed-in visitors can reach these through Supabase directly, so restore them too.
  if (!(await restoreDemoLogin(service))) throw new Error('Could not restore the demo login');
  return true;
}

/** Puts back the demo account's email, password and name. False when the demo isn't configured or the update fails. */
export async function restoreDemoLogin(service: SupabaseClient): Promise<boolean> {
  const userId = process.env.DEMO_USER_ID;
  if (!userId || !process.env.DEMO_EMAIL || !process.env.DEMO_PASSWORD) return false;
  const { error } = await service.auth.admin.updateUserById(userId, { email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Demo User' } });
  if (error) console.error('Could not restore the demo login:', error.message);
  return !error;
}
