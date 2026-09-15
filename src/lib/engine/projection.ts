export type ContributionFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';
export interface ProjectionInput { starting: number; monthlyContribution: number; annualReturn: number; contributionFrequency?: ContributionFrequency }
export interface ProjectionPoint { month: number; value: number; contributed: number }
export interface BankComparisonPoint { year: number; nominal: number; real: number }
export function projectBankComparison(starting: number, annualRatePct: number, inflationPct: number, years: number): BankComparisonPoint[] {
  const count = Math.max(0, Math.floor(years)); const principal = Math.max(0, starting); const rate = 1 + Math.max(0, annualRatePct) / 100; const inflation = 1 + Math.max(0, inflationPct) / 100;
  return Array.from({ length: count + 1 }, (_, year) => ({ year, nominal: principal * rate ** year, real: principal * (rate / inflation) ** year }));
}

export interface AccountProjectionInput {
  tfsaRoom: number;
  rrspRoom: number;
  tfsaMonthly: number;
  rrspMonthly: number;
  cashMonthly?: number;
  /** Explicit planning assumption. Set to zero when no future addition is desired. */
  tfsaAnnualRoomAddition: number;
  /** Current calendar month, zero based. Defaults to January. */
  startMonth?: number;
}

export interface AccountProjectionPoint {
  month: number;
  tfsaRoom: number;
  rrspRoom: number;
  tfsaContributed: number;
  rrspContributed: number;
  cashContributed: number;
  excessCash: number;
}

export function projectSeries(input: ProjectionInput, months: number): ProjectionPoint[] {
  const r = input.annualReturn / 12;
  const periods = { weekly: 52, biweekly: 26, monthly: 12, yearly: 1 }[input.contributionFrequency ?? 'monthly'];
  const annualContribution = input.monthlyContribution * periods;
  const count = Math.max(0, Math.floor(months));
  const points: ProjectionPoint[] = [{ month: 0, value: input.starting, contributed: input.starting }];
  let value = input.starting;
  for (let month = 1; month <= count; month += 1) {
    const contribution = input.contributionFrequency === 'yearly' ? (month % 12 === 0 ? input.monthlyContribution : 0) : annualContribution / 12;
    value = value * (1 + r) + contribution;
    points.push({ month, value, contributed: input.starting + annualContribution * month / 12 });
  }
  return points;
}

export function futureValue(input: ProjectionInput, years: number) {
  const months = Math.max(0, Math.floor(years * 12));
  const value = projectSeries(input, months).at(-1)!.value;
  const periods = { weekly: 52, biweekly: 26, monthly: 12, yearly: 1 }[input.contributionFrequency ?? 'monthly'];
  const contributed = input.starting + input.monthlyContribution * periods * months / 12;
  return { value, contributed, growth: value - input.starting };
}

/**
 * Projects contribution room under the account rules. TFSA room is replenished
 * only at January boundaries by the explicit configured assumption. RRSP room
 * never receives an invented annual addition. Any capped contribution is shown
 * as excess cash so callers cannot silently redirect it to another account.
 */
export function projectAccountSeries(input: AccountProjectionInput, months: number): AccountProjectionPoint[] {
  const count = Math.max(0, Math.floor(months));
  const startMonth = ((input.startMonth ?? 0) % 12 + 12) % 12;
  let tfsaRoom = Math.max(0, input.tfsaRoom);
  let rrspRoom = Math.max(0, input.rrspRoom);
  let tfsaContributed = 0;
  let rrspContributed = 0;
  let cashContributed = 0;
  const points: AccountProjectionPoint[] = [{ month: 0, tfsaRoom, rrspRoom, tfsaContributed, rrspContributed, cashContributed, excessCash: 0 }];
  for (let month = 1; month <= count; month += 1) {
    if ((startMonth + month) % 12 === 0) tfsaRoom += Math.max(0, input.tfsaAnnualRoomAddition);
    const tfsaPlanned = Math.max(0, input.tfsaMonthly);
    const rrspPlanned = Math.max(0, input.rrspMonthly);
    const tfsaUsed = Math.min(tfsaRoom, tfsaPlanned);
    const rrspUsed = Math.min(rrspRoom, rrspPlanned);
    const excessCash = (tfsaPlanned - tfsaUsed) + (rrspPlanned - rrspUsed);
    tfsaRoom -= tfsaUsed;
    rrspRoom -= rrspUsed;
    tfsaContributed += tfsaUsed;
    rrspContributed += rrspUsed;
    cashContributed += Math.max(0, input.cashMonthly ?? 0);
    points.push({ month, tfsaRoom, rrspRoom, tfsaContributed, rrspContributed, cashContributed, excessCash });
  }
  return points;
}
