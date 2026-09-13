import type { AccountKey, InvestableAccount, PlanInput, PlanResult, Alert } from './types';
import type { FxProviderConfig } from './fx';
import { convertCadToUsd } from './fx';

const INVESTABLE: InvestableAccount[] = ['TFSA', 'RRSP'];
const ALL_ACCOUNTS: AccountKey[] = ['TFSA', 'RRSP', 'CASH'];

export function computePlan(input: PlanInput): PlanResult {
  const alerts: Alert[] = [];
  const surplus = input.monthlyIncome - input.monthlyExpenses;
  if (surplus < 0) alerts.push({ kind: 'NEGATIVE_SURPLUS', surplus });

  const acctSum =
    (input.accountAllocation.TFSA ?? 0) + (input.accountAllocation.RRSP ?? 0) + (input.accountAllocation.CASH ?? 0);
  if (Math.abs(acctSum - 1) > 0.001) alerts.push({ kind: 'ALLOCATION_SUM', where: 'account', sum: acctSum });
  for (const acct of INVESTABLE) {
    const list = input.etfAllocation[acct] ?? [];
    const s = list.reduce((t, e) => t + e.pct, 0);
    if (list.length > 0 && Math.abs(s - 1) > 0.001) alerts.push({ kind: 'ALLOCATION_SUM', where: 'etf', sum: s });
  }
  if (input.emergencyFund < input.emergencyTarget) {
    alerts.push({ kind: 'EMERGENCY_BELOW_TARGET', fund: input.emergencyFund, target: input.emergencyTarget });
  }

  const investableSurplus = Math.max(surplus, 0);
  const rooms = { ...input.rooms };

  const accounts = ALL_ACCOUNTS.map((key) => {
    const pct = input.accountAllocation[key] ?? 0;
    const raw = investableSurplus * pct;
    if (key === 'CASH') return { key, raw, effective: raw, capped: false, roomUsed: 0 };

    const room = rooms[key];
    const effective = Math.min(raw, room);
    rooms[key] = room - effective;
    const annual = effective * 12;
    if (annual > room) {
      alerts.push({ kind: 'ROOM_LOW', account: key, roomLeft: Math.max(room - annual, 0) });
    } else if (room > 0 && room - annual < room * 0.2) {
      alerts.push({ kind: 'ROOM_NEARLY_GONE', account: key, roomLeft: Math.max(room - annual, 0) });
    }
    return { key, raw, effective, capped: effective < raw - 1e-9, roomUsed: effective };
  });

  const purchases: PlanResult['purchases'] = [];
  const fx: PlanResult['fx'] = [];
  for (const acct of INVESTABLE) {
    const account = accounts.find((a) => a.key === acct)!;
    for (const alloc of input.etfAllocation[acct] ?? []) {
      const cadAmount = account.effective * alloc.pct;
      if (cadAmount <= 0) continue;
      let nativeAmount = cadAmount;
      if (alloc.instrument.currency === 'USD') {
        const cfg: FxProviderConfig = input.fx[alloc.instrument.ticker] ?? { provider: 'TD', rate: 1.35 };
        const r = convertCadToUsd(cadAmount, cfg.rate, cfg);
        nativeAmount = r.usdReceived;
        fx.push({
          ticker: alloc.instrument.ticker,
          cadAmount,
          provider: cfg.provider,
          usdReceived: r.usdReceived,
          fxCostCad: r.fxCostCad,
        });
      }
      purchases.push({ account: acct, instrument: alloc.instrument, cadAmount, nativeAmount });
    }
  }

  const effectiveOf = (k: InvestableAccount) => accounts.find((a) => a.key === k)!.effective;

  return {
    surplus,
    savingsRate: input.monthlyIncome > 0 ? surplus / input.monthlyIncome : 0,
    accounts,
    purchases,
    fx,
    projectedAnnual: { TFSA: effectiveOf('TFSA') * 12, RRSP: effectiveOf('RRSP') * 12 },
    alerts,
  };
}

/** Room at a point in time: start, minus planned annual spend, plus TFSA withdrawal room restored next year. */
export function roomAfterContributions(room: number, projectedAnnual: number, withdrawalsRestoringNextYear = 0): number {
  return room - projectedAnnual + withdrawalsRestoringNextYear;
}

export interface RoomPoint {
  month: number;
  remaining: number;
}

/**
 * Remaining contribution room month over month. month 0 = now.
 * Each month: remaining = max(0, remaining - monthlyContribution) + restorations due that month.
 * Clamping at 0 models the dashboard's room cap (contributions stop once room is exhausted).
 */
export function roomTrajectory(
  room: number,
  monthlyContribution: number,
  months: number,
  restorations: { atMonth: number; amount: number }[] = []
): RoomPoint[] {
  const restoreAt = new Map<number, number>();
  for (const r of restorations) restoreAt.set(r.atMonth, (restoreAt.get(r.atMonth) ?? 0) + r.amount);
  const out: RoomPoint[] = [{ month: 0, remaining: room }];
  let remaining = room;
  for (let m = 1; m <= months; m++) {
    remaining = Math.max(0, remaining - monthlyContribution) + (restoreAt.get(m) ?? 0);
    out.push({ month: m, remaining });
  }
  return out;
}