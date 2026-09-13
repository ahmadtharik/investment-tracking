export type AccountKey = 'TFSA' | 'RRSP' | 'CASH';
export type InvestableAccount = 'TFSA' | 'RRSP';

export interface InstrumentRef {
  id: number;
  ticker: string;
  name: string;
  currency: 'CAD' | 'USD';
}

export type { FxProviderConfig } from './fx';
import type { FxProviderConfig } from './fx';

export interface PlanInput {
  monthlyIncome: number;
  monthlyExpenses: number;
  emergencyFund: number;
  emergencyTarget: number;
  /** Fractions (0.6 = 60%). Should sum to 1 — violations produce an ALLOCATION_SUM alert. */
  accountAllocation: Partial<Record<AccountKey, number>>;
  /** Each account's list should sum to 1 — violations produce an ALLOCATION_SUM alert. */
  etfAllocation: Partial<Record<InvestableAccount, { instrument: InstrumentRef; pct: number }[]>>;
  /** Currently available contribution room in CAD. */
  rooms: { TFSA: number; RRSP: number };
  /** Per USD-instrument FX provider config, keyed by ticker. */
  fx: Record<string, FxProviderConfig>;
}

export interface FxBreakdown {
  ticker: string;
  cadAmount: number;
  provider: string;
  usdReceived: number;
  fxCostCad: number;
}

export interface PlanResult {
  surplus: number;
  /** surplus / income, 0 when income = 0 */
  savingsRate: number;
  accounts: { key: AccountKey; raw: number; effective: number; capped: boolean; roomUsed: number }[];
  /** nativeAmount is in the instrument's own currency (USD for VTI). */
  purchases: { account: InvestableAccount; instrument: InstrumentRef; cadAmount: number; nativeAmount: number }[];
  /** One entry per USD-instrument purchase. */
  fx: FxBreakdown[];
  /** effective × 12 per investable account */
  projectedAnnual: { TFSA: number; RRSP: number };
  alerts: Alert[];
}

export type Alert =
  | { kind: 'ROOM_LOW'; account: InvestableAccount; roomLeft: number }
  | { kind: 'ROOM_NEARLY_GONE'; account: InvestableAccount; roomLeft: number }
  | { kind: 'ALLOCATION_SUM'; where: 'account' | 'etf'; sum: number }
  | { kind: 'EMERGENCY_BELOW_TARGET'; fund: number; target: number }
  | { kind: 'NEGATIVE_SURPLUS'; surplus: number };