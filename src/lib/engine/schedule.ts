import type { AccountKey, PlanInput } from './types';

export interface InstalmentLine {
  account: AccountKey;
  instrumentId: number | null;
  ticker: string | null;
  currency: 'CAD' | 'USD';
  amountCad: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const cents = (n: number) => Math.round(n * 100) / 100;

/** The due date for a month, using its last day when the month is too short. */
export function dueDateIn(year: number, monthIndex: number, dayOfMonth: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const normalized = new Date(Date.UTC(year, monthIndex, 1));
  return `${normalized.getUTCFullYear()}-${pad(normalized.getUTCMonth() + 1)}-${pad(Math.min(dayOfMonth, lastDay))}`;
}

/** First due date on or after `date` (YYYY-MM-DD). */
export function firstDueOnOrAfter(date: string, dayOfMonth: number): string {
  const [year, month] = date.split('-').map(Number);
  const inMonth = dueDateIn(year, month - 1, dayOfMonth);
  return inMonth >= date ? inMonth : dueDateIn(year, month, dayOfMonth);
}

/**
 * Next due date when starting, resuming or changing the day. A month that already
 * has a handled instalment is passed over, so a new day can't record a second one.
 */
export function nextDueFrom(today: string, dayOfMonth: number, lastHandled?: string): string {
  const due = firstDueOnOrAfter(today, dayOfMonth);
  if (!lastHandled || due.slice(0, 7) > lastHandled.slice(0, 7)) return due;
  return dueAfter(lastHandled, dayOfMonth);
}

/**
 * Next due date after changing the day of an active schedule. An instalment still
 * open this month keeps its date, so moving to an earlier day can't skip the month.
 */
export function nextDueForNewDay(today: string, dayOfMonth: number, currentDue: string, lastHandled?: string): string {
  const due = nextDueFrom(today, dayOfMonth, lastHandled);
  return currentDue >= today && currentDue.slice(0, 7) < due.slice(0, 7) ? currentDue : due;
}

/** The due date in the month after `due` (YYYY-MM-DD). */
export function dueAfter(due: string, dayOfMonth: number): string {
  const [year, month] = due.split('-').map(Number);
  return dueDateIn(year, month, dayOfMonth);
}

/** Calendar date in Canada's most populated zone, so server (UTC) evenings don't land on tomorrow. */
export function todayInToronto(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * Splits one month's surplus by the plan's percentages. Contribution room is
 * not applied here: resolve_cycle caps against the live balance in one transaction.
 * The last investment in an account takes any rounding remainder.
 */
export function buildInstalment(input: PlanInput): InstalmentLine[] {
  const surplus = Math.max(input.monthlyIncome - input.monthlyExpenses, 0);
  const lines: InstalmentLine[] = [];
  for (const account of ['TFSA', 'RRSP', 'CASH'] as const) {
    const accountAmount = cents(surplus * (input.accountAllocation[account] ?? 0));
    if (accountAmount <= 0) continue;
    const investments = account === 'CASH' ? [] : (input.etfAllocation[account] ?? []).filter((item) => item.pct > 0);
    if (investments.length === 0) {
      lines.push({ account, instrumentId: null, ticker: null, currency: 'CAD', amountCad: accountAmount });
      continue;
    }
    let remaining = accountAmount;
    investments.forEach((item, index) => {
      const amountCad = index === investments.length - 1 ? cents(remaining) : cents(accountAmount * item.pct);
      remaining -= amountCad;
      if (amountCad > 0) lines.push({ account, instrumentId: item.instrument.id, ticker: item.instrument.ticker, currency: item.instrument.currency, amountCad });
    });
  }
  return lines;
}

/**
 * Whether a manual purchase should default to covering the next instalment:
 * dated in the same calendar month, or within a week before it. This is the
 * realistic double-contribution case, so the safe answer is the default.
 */
export function coversNextByDefault(contributedOn: string, nextDue: string): boolean {
  if (contributedOn.slice(0, 7) === nextDue.slice(0, 7)) return true;
  const days = (Date.parse(nextDue) - Date.parse(contributedOn)) / 86_400_000;
  return days >= 0 && days <= 7;
}
