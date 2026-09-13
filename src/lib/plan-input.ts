import type { PlanInput, InstrumentRef } from './engine/types';
import type { FxProviderConfig } from './engine/fx';
import type { AccountAllocRow, EtfAllocRow, FxPrefRow, InstrumentRow, Profile } from './db/queries';

/** Stand-in FX config until the /fx page persists a live CAD=X rate per instrument. */
const DEFAULT_FX: FxProviderConfig = { provider: 'TD', rate: 1.35 };

/** Maps the DB rows loaded on the dashboard into the planner engine's PlanInput. */
export function toPlanInput(
  profile: Profile,
  accountAlloc: AccountAllocRow[],
  etfAlloc: EtfAllocRow[],
  instruments: InstrumentRow[],
  fxPrefs: FxPrefRow[] = []
): PlanInput {
  const byId = new Map(instruments.map((i) => [i.id, i]));

  const accountAllocation: PlanInput['accountAllocation'] = {};
  for (const r of accountAlloc) {
    if (r.account === 'TFSA' || r.account === 'RRSP' || r.account === 'CASH') accountAllocation[r.account] = r.pct;
  }

  const etfAllocation: PlanInput['etfAllocation'] = { TFSA: [], RRSP: [] };
  for (const r of etfAlloc) {
    const acct = r.account;
    if (acct !== 'TFSA' && acct !== 'RRSP') continue;
    const inst = byId.get(r.instrument_id);
    if (!inst) continue; // allocation row for an unknown instrument — skip
    const ref: InstrumentRef = {
      id: inst.id,
      ticker: inst.ticker,
      name: inst.name,
      currency: inst.currency === 'USD' ? 'USD' : 'CAD',
    };
    (etfAllocation[acct] ??= []).push({ instrument: ref, pct: r.pct });
  }

  const fx: Record<string, FxProviderConfig> = {};
  for (const acct of ['TFSA', 'RRSP'] as const) {
    for (const a of etfAllocation[acct] ?? []) {
      if (a.instrument.currency !== 'USD' || fx[a.instrument.ticker]) continue;
      const pref = fxPrefs.find((p) => p.ticker === a.instrument.ticker);
      fx[a.instrument.ticker] = pref
        ? { provider: pref.provider, rate: pref.custom_rate ?? DEFAULT_FX.rate }
        : DEFAULT_FX;
    }
  }

  return {
    monthlyIncome: profile.monthly_income,
    monthlyExpenses: profile.monthly_expenses,
    emergencyFund: profile.emergency_fund,
    emergencyTarget: profile.emergency_target,
    accountAllocation,
    etfAllocation,
    rooms: { TFSA: profile.tfsa_room, RRSP: profile.rrsp_room },
    fx,
  };
}