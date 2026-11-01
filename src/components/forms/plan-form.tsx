"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clientSupabase } from "@/lib/supabase/client";
import { saveAccountAllocations, type AccountAllocRow } from "@/lib/db/queries";
import { futureValue } from "@/lib/engine/projection";
import { formatCAD, formatPct } from "@/lib/format";
import { settleBeforePlanChange } from "@/lib/schedule/client";
import { ContributionRunway } from "@/components/contribution-runway";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";

type AccountKey = AccountAllocRow["account"];
type Contribution = { account: string; amount: number; date: string };
type RowState = { account: AccountKey; pct: string; amount: string };

const ACCOUNTS: {
  key: AccountKey;
  label: string;
  color: string;
  soft: string;
  icon: AppIconName;
}[] = [
  {
    key: "TFSA",
    label: "TFSA",
    color: "#3B82F6",
    soft: "bg-blue-50 text-blue-600",
    icon: "leaf",
  },
  {
    key: "RRSP",
    label: "RRSP",
    color: "#FB923C",
    soft: "bg-orange-50 text-orange-500",
    icon: "bank",
  },
  {
    key: "CASH",
    label: "Cash",
    color: "#34C786",
    soft: "bg-emerald-50 text-emerald-600",
    icon: "cash",
  },
];
const PROJECTION_YEARS = 10;
const PROJECTION_RETURN = 7;
const numeric = (value: string) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
// Plan form percentages are displayed as whole-percent values (for example 60,
// not the persisted decimal 0.6). Keep two decimal places without scaling the
// value again when an amount input changes by cents.
const toPct = (n: number) => String(Math.round(n * 100) / 100);
const toAmount = (n: number) => n.toFixed(2);

function allocationRows(
  monthlySurplus: number,
  accountAlloc: AccountAllocRow[],
): RowState[] {
  return ACCOUNTS.map(({ key }) => {
    const pct = accountAlloc.find((row) => row.account === key)?.pct ?? 0;
    return {
      account: key,
      pct: toPct(pct * 100),
      amount: toAmount(monthlySurplus * pct),
    };
  });
}

function Icon({
  name,
  tone = "blue",
}: {
  name: AppIconName;
  tone?: "blue" | "green" | "orange";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-500",
  };
  return (
    <span
      aria-hidden
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-bold ${tones[tone]}`}
    >
      <AppIcon name={name} className="h-5 w-5" />
    </span>
  );
}

export function PlanWorkspace({
  userId,
  month,
  monthlySurplus,
  accountAlloc,
  contributions,
  portfolioValue,
  tfsaRoom,
  rrspRoom,
  baseline,
  purchases,
  schedule,
}: {
  baseline?: React.ReactNode;
  purchases?: React.ReactNode;
  schedule?: React.ReactNode;
  userId: string;
  month: string;
  monthlySurplus: number;
  accountAlloc: AccountAllocRow[];
  contributions: Contribution[];
  portfolioValue: number;
  tfsaRoom: number;
  rrspRoom: number;
}) {
  const router = useRouter();
  // `rows` is the editable draft. Keep a separate committed snapshot so the
  // Cancel control can discard a draft without changing what the page shows.
  const [committedRows, setCommittedRows] = useState<RowState[]>(() =>
    allocationRows(monthlySurplus, accountAlloc),
  );
  const [rows, setRows] = useState<RowState[]>(() =>
    allocationRows(monthlySurplus, accountAlloc),
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const chartYears = [...new Set([new Date().getFullYear(), ...contributions.map(c => Number(c.date.slice(0, 4)))])].sort((a,b) => b-a);
  const totalPct = useMemo(
    () => rows.reduce((sum, row) => sum + numeric(row.pct), 0),
    [rows],
  );
  const allocated = useMemo(
    () => rows.reduce((sum, row) => sum + numeric(row.amount), 0),
    [rows],
  );
  const localNow = new Date();
  const currentMonth = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, "0")}`;
  const investedThisMonth = contributions
    .filter((item) => item.date.slice(0, 7) === currentMonth)
    .reduce((sum, item) => sum + item.amount, 0);
  // What can actually go in this month: registered accounts stop at their room.
  const plannedTotal = rows.reduce((sum, row) => {
    const amount = numeric(row.amount);
    if (row.account === "TFSA") return sum + Math.min(amount, Math.max(0, tfsaRoom));
    if (row.account === "RRSP") return sum + Math.min(amount, Math.max(0, rrspRoom));
    return sum + amount;
  }, 0);
  const status =
    plannedTotal <= 0
      ? "neutral"
      : investedThisMonth >= plannedTotal
        ? "on-track"
        : "behind";
  const progress =
    plannedTotal > 0 ? Math.min(1, investedThisMonth / plannedTotal) : 0;
  const projected = futureValue(
    { starting: Math.max(0, portfolioValue), monthlyContribution: plannedTotal, annualReturn: PROJECTION_RETURN / 100, contributionFrequency: "monthly" },
    PROJECTION_YEARS,
  );
  const monthlyBars = useMemo(() => {
    const now = new Date();
    const year = chartYear;
    return Array.from({ length: 12 }, (_, index) => {
      const actual = contributions
        .filter((item) => {
          const date = new Date(`${item.date}T12:00:00`);
          return date.getFullYear() === year && date.getMonth() === index;
        })
        .reduce((sum, item) => sum + item.amount, 0);
      return {
        month: new Intl.DateTimeFormat("en-CA", { month: "short" }).format(
          new Date(year, index, 1),
        ),
        planned: chartYear === now.getFullYear() ? plannedTotal : 0,
        actual,
      };
    });
  }, [contributions, plannedTotal, chartYear]);
  const updatePct = (index: number, pct: string) =>
    setRows((current) =>
      current.map((row, i) =>
        i === index
          ? {
              ...row,
              pct,
              amount: toAmount((monthlySurplus * numeric(pct)) / 100),
            }
          : row,
      ),
    );
  const updateAmount = (index: number, amount: string) =>
    setRows((current) =>
      current.map((row, i) =>
        i === index
          ? {
              ...row,
              amount,
              pct:
                monthlySurplus > 0
                  ? toPct((numeric(amount) / monthlySurplus) * 100)
                  : "0",
            }
          : row,
      ),
    );
  async function save() {
    setError(null);
    setSaved(false);
    if (Math.abs(totalPct - 100) > 0.01) {
      setError(
        `Allocation must total 100%. It currently totals ${totalPct.toFixed(1)}%.`,
      );
      return;
    }
    setSaving(true);
    try {
      await settleBeforePlanChange();
      await saveAccountAllocations(
        clientSupabase(),
        userId,
        rows.map((row) => ({
          account: row.account,
          pct: numeric(row.pct) / 100,
        })),
      );
      setCommittedRows(rows);
      router.refresh();
      setSaved(true);
      setEditing(false);
      window.setTimeout(() => setSaved(false), 3500);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save your plan. Your existing data was not changed.",
      );
    } finally {
      setSaving(false);
    }
  }
  function cancelEditing() {
    setRows(committedRows);
    setError(null);
    setEditing(false);
  }

  return (
    <div className="mx-auto w-full max-w-[1276px]">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
            Plan
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manage your monthly surplus and allocation across accounts.
          </p>
        </div>
        <div className="flex min-h-[62px] items-center gap-3 rounded-xl bg-[var(--color-primary-subtle)] px-4 py-3 lg:w-[550px]">
          <Icon name="target" />
          <div>
            <p className={`text-sm font-bold ${status === "on-track" ? "text-emerald-700" : "text-[var(--text-primary)]"}`}>
              {status === "on-track"
                ? "You're on track!"
                : status === "behind"
                  ? "Review your plan"
                  : "Set up your plan"}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {status === "on-track"
                ? `You've allocated and invested ${formatPct(progress)} of this month's plan.`
                : status === "behind"
                  ? `${formatCAD(Math.max(0, plannedTotal - investedThisMonth))} remains in this month's plan.`
                  : "Set your monthly allocation to start tracking progress."}
            </p>
          </div>
        </div>
      </header>
      {baseline}

      <div className="mt-3">
        <section className="rounded-[14px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Icon name="plan" />
              <div>
                <h2 className="text-[18px] font-bold text-[var(--text-primary)]">
                  {month} plan
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Allocate your monthly surplus across accounts.
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium text-[var(--text-muted)]">
                Monthly surplus
              </p>
              <p className="text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {formatCAD(monthlySurplus)}
              </p>
            </div>
          </div>
          <div id="allocation-editor" className="mt-2 rounded-xl border border-blue-100 bg-white p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Allocation
              </h3>
              <button
                disabled={saving}
                onClick={() => (editing ? cancelEditing() : setEditing(true))}
                className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]"
              >
                {editing ? "Cancel" : "Edit"}
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {rows.map((row, index) => {
                const account = ACCOUNTS.find(
                  (item) => item.key === row.account,
                )!;
                const amount = numeric(row.amount);
                const pct = numeric(row.pct);
                return (
                  <div
                    key={row.account}
                    className="grid grid-cols-[38px_72px_minmax(100px,1fr)_42px] items-center gap-3"
                  >
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${account.soft}`}
                    >
                      <AppIcon name={account.icon} className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {account.label}
                    </span>
                    {editing ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <label className="relative min-w-0 flex-1">
                          <span className="sr-only">
                            {account.label} amount
                          </span>
                          <span className="absolute left-2 top-1.5 text-xs text-[var(--text-muted)]">
                            $
                          </span>
                          <input
                            className="h-8 w-full rounded-md border border-[var(--border)] pl-5 pr-1 text-xs font-semibold tabular-nums"
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={saving}
                            value={row.amount}
                            onChange={(event) =>
                              updateAmount(index, event.target.value)
                            }
                          />
                        </label>
                        <label className="relative w-14">
                          <span className="sr-only">
                            {account.label} percentage
                          </span>
                          <input
                            className="h-8 w-full rounded-md border border-[var(--border)] px-1 text-center text-xs font-semibold"
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            disabled={saving}
                            value={row.pct}
                            onChange={(event) =>
                              updatePct(index, event.target.value)
                            }
                          />
                          <span className="absolute right-1 top-1.5 text-[10px] text-[var(--text-muted)]">
                            %
                          </span>
                        </label>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-bold tabular-nums text-[var(--text-primary)]">
                            {formatCAD(amount)}
                          </p>
                          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                backgroundColor: account.color,
                              }}
                            />
                          </div>
                        </div>
                        <span className="text-right text-sm font-semibold tabular-nums text-[var(--text-muted)]">
                          {formatPct(pct / 100)}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-sm">
              <span className="font-bold text-[var(--text-primary)]">
                Total
              </span>
              <span className="font-bold tabular-nums text-[var(--text-primary)]">
                {formatCAD(allocated)}
              </span>
              <span className="font-bold tabular-nums text-[var(--text-primary)]">
                {formatPct(totalPct / 100)}
              </span>
            </div>
            {editing && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save plan"}
                </button>
                {saved && (
                  <span className="text-xs font-semibold text-emerald-600">
                    Plan saved
                  </span>
                )}
                {error && (
                  <span
                    role="alert"
                    className="text-xs font-semibold text-red-600"
                  >
                    {error}
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
        <section className="rounded-[14px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-[var(--text-primary)]">
              Planned vs. actual contributions
            </h2>
            <select aria-label="Contribution chart year" value={chartYear} onChange={e => setChartYear(Number(e.target.value))} className="h-8 rounded-lg border border-[var(--border)] bg-white px-2 text-xs">
              {chartYears.map(year => <option key={year} value={year}>{year === new Date().getFullYear() ? 'This year' : year}</option>)}
            </select>
          </div>
          <div
            className="mt-3 h-[195px]"
            role="img"
            aria-label="Actual contributions compared with the current recurring plan"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyBars}
                margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
              >
                <CartesianGrid stroke="#E2E8F0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) =>
                    value === 0 ? "$0" : `$${Math.round(value / 1000)}k`
                  }
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  width={40}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatCAD(Number(value)),
                    name === "actual" ? "Actual" : "Planned",
                  ]}
                />
                <Bar
                  dataKey="planned"
                  fill="#BFDBFE"
                  radius={[3, 3, 0, 0]}
                  barSize={17}
                />
                <Bar
                  dataKey="actual"
                  fill="#3B82F6"
                  radius={[3, 3, 0, 0]}
                  barSize={17}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex justify-center gap-5 text-[11px] text-[var(--text-muted)]">
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-200" />
              Planned
            </span>
            <span>
              <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
              Actual
            </span>
          </div>
        </section>
      </div>

      {purchases}
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.75fr)]">
        <ContributionRunway tfsaRoom={tfsaRoom} rrspRoom={rrspRoom} tfsaMonthly={numeric(rows.find((row) => row.account === 'TFSA')?.amount ?? '0')} rrspMonthly={numeric(rows.find((row) => row.account === 'RRSP')?.amount ?? '0')} />
        <section className="rounded-[14px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex justify-between">
            <h2 className="text-[16px] font-bold">Plan insights</h2>
            <Link
              href="/projections"
              className="text-xs font-semibold text-[var(--color-primary)]"
            >
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            <Insight
              tone={status === "on-track" ? "green" : "orange"}
              icon={status === "on-track" ? "check" : "alert"}
              title={
                status === "on-track"
                  ? "You're on track"
                  : "Contribution needed"
              }
              copy={
                status === "on-track"
                  ? `You've invested ${formatPct(progress)} of your planned amount this month.`
                  : `${formatCAD(Math.max(0, plannedTotal - investedThisMonth))} remains to invest this month.`
              }
            />
            <Insight
              tone="blue"
              icon="projections"
              title="Projection estimate"
              copy={`${formatCAD(projected.value)} is your estimated ${PROJECTION_YEARS}-year portfolio value at ${PROJECTION_RETURN}%.`}
            />
            <Insight
              tone="orange"
              icon="settings"
              title="Plan stays editable"
              copy="Adjust allocation percentages whenever your monthly surplus changes."
            />
          </div>
        </section>
      </div>

      {schedule}
    </div>
  );
}

function Insight({
  tone,
  icon,
  title,
  copy,
}: {
  tone: "blue" | "green" | "orange";
  icon: AppIconName;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--border)] p-2.5">
      <Icon tone={tone} name={icon} />
      <div>
        <p className="text-xs font-bold text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">
          {copy}
        </p>
      </div>
    </div>
  );
}
