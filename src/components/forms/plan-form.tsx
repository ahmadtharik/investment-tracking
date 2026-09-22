"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clientSupabase } from "@/lib/supabase/client";
import { saveAccountAllocations, type AccountAllocRow } from "@/lib/db/queries";
import { futureValue, projectSeries } from "@/lib/engine/projection";
import { formatCAD, formatPct } from "@/lib/format";
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
const HORIZONS = [5, 10, 20, 30] as const;
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

function ActionIcon({ name }: { name: AppIconName }) {
  return (
    <span className="text-xl leading-none text-[var(--color-primary)]">
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
}: {
  baseline?: React.ReactNode;
  purchases?: React.ReactNode;
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
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(10);
  const [annualReturn, setAnnualReturn] = useState(7);
  const deferredAnnualReturn = useDeferredValue(annualReturn);
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
  const plannedTotal = Math.max(0, allocated);
  const status =
    plannedTotal <= 0
      ? "neutral"
      : investedThisMonth >= plannedTotal
        ? "on-track"
        : "behind";
  const progress =
    plannedTotal > 0 ? Math.min(1, investedThisMonth / plannedTotal) : 0;
  const projectionInput = {
    starting: Math.max(0, portfolioValue),
    monthlyContribution: Math.max(0, plannedTotal),
    annualReturn: deferredAnnualReturn / 100,
    contributionFrequency: "monthly" as const,
  };
  const series = useMemo(
    () => projectSeries(projectionInput, horizon * 12),
    [portfolioValue, plannedTotal, deferredAnnualReturn, horizon],
  );
  const projected = series.at(-1) ?? { value: 0, contributed: 0 };
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
  const ticks = [
    0,
    Math.round(horizon * 0.2) * 12,
    Math.round(horizon * 0.5) * 12,
    horizon * 12,
  ];

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
            <p className="text-sm font-bold text-emerald-700">
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
                      {account.icon}
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
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)]">
        <section className="rounded-[14px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-[16px] font-bold">Plan settings</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-[var(--text-muted)]">
              Time horizon
              <select
                value={horizon}
                onChange={(event) =>
                  setHorizon(Number(event.target.value) as typeof horizon)
                }
                className="mt-1 h-9 w-full rounded-lg border border-[var(--border)] bg-white px-2 text-sm font-semibold text-[var(--text-primary)]"
              >
                {HORIZONS.map((years) => (
                  <option key={years} value={years}>
                    {years} years
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              Expected annual return
              <span className="mt-1 grid h-9 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2">
                <b className="w-10 text-sm tabular-nums text-[var(--text-primary)]">
                  {annualReturn}%
                </b>
                <input
                  aria-label="Expected annual return"
                  className="min-w-0 w-full accent-blue-600"
                  type="range"
                  min={0}
                  max={12}
                  step={0.5}
                  value={annualReturn}
                  onChange={(event) =>
                    setAnnualReturn(Number(event.target.value))
                  }
                />
              </span>
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              Currency
              <span className="mt-1 flex h-9 items-center rounded-lg border border-[var(--border)] px-2 text-sm font-semibold text-[var(--text-primary)]">
                CAD (Canadian Dollar)
              </span>
            </label>
          </div>
        </section>
        <section className="hidden rounded-[14px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="text-[16px] font-bold">Quick actions</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: "plus" as const, label: "Record a contribution", href: "/accounts" },
              {
                icon: "sliders" as const,
                label: "Adjust plan",
                action: () => setEditing(true),
              },
              { icon: "settings" as const, label: "Set up rules", href: "/settings" },
              { icon: "accounts" as const, label: "View accounts", href: "/accounts" },
            ].map((action) =>
              action.href ? (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex min-h-[60px] flex-col justify-between rounded-lg border border-blue-100 bg-blue-50/60 p-2 text-[11px] font-semibold text-[var(--color-primary)]"
                >
                  <ActionIcon name={action.icon} />
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  onClick={action.action}
                  className="flex min-h-[60px] flex-col justify-between rounded-lg border border-blue-100 bg-blue-50/60 p-2 text-left text-[11px] font-semibold text-[var(--color-primary)]"
                >
                  <ActionIcon name={action.icon} />
                  {action.label}
                </button>
              ),
            )}
          </div>
        </section>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.75fr)]">
        <ContributionRunway tfsaRoom={tfsaRoom} rrspRoom={rrspRoom} tfsaMonthly={numeric(rows.find((row) => row.account === 'TFSA')?.amount ?? '0')} rrspMonthly={numeric(rows.find((row) => row.account === 'RRSP')?.amount ?? '0')} />
        <section className="hidden rounded-[14px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex justify-between gap-3">
            <h2 className="text-[16px] font-bold">Projected portfolio value</h2>
            <label>
              <span className="sr-only">Projection horizon</span>
              <select
                aria-label="Projection horizon"
                value={horizon}
                onChange={(event) => setHorizon(Number(event.target.value) as typeof horizon)}
                className="h-8 rounded-lg border border-[var(--border)] bg-white px-2.5 text-xs font-semibold text-[var(--text-primary)]"
              >
                {HORIZONS.map((years) => <option key={years} value={years}>{years} years</option>)}
              </select>
            </label>
          </div>
          <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div>
              <div
                className="h-[188px]"
                role="img"
                aria-label={`Projected portfolio value across ${horizon} years`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={series}
                    margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="planProjectionFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#3B82F6"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="#3B82F6"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      ticks={ticks}
                      tickFormatter={(value) =>
                        value === 0 ? "Now" : `${Math.round(value / 12)}y`
                      }
                      tick={{ fontSize: 10, fill: "#64748B" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        value === 0 ? "$0" : `$${Math.round(value / 1000)}K`
                      }
                      tick={{ fontSize: 10, fill: "#64748B" }}
                      width={42}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCAD(Number(value)),
                        name === "contributed"
                          ? "Contributions"
                          : "Portfolio value",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      fill="url(#planProjectionFill)"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="contributed"
                      stroke="#2563EB"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-5 text-[11px] text-[var(--text-muted)]">
                <span>
                  <i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                  Portfolio value
                </span>
                <span>
                  <i className="mr-1.5 inline-block w-4 border-t-2 border-dashed border-blue-500" />
                  Contributions
                </span>
              </div>
            </div>
            <dl className="rounded-xl bg-blue-50/70 p-4">
              <div>
                <dt className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                  {formatCAD(projected.value)}
                </dt>
                <dd className="text-xs text-[var(--text-muted)]">
                  Estimated value in {horizon} years
                </dd>
              </div>
              <div className="mt-4 border-t border-blue-100 pt-3">
                <dt className="text-sm font-bold tabular-nums">
                  {formatCAD(projected.contributed)}
                </dt>
                <dd className="text-xs text-[var(--text-muted)]">
                  Your contributions
                </dd>
              </div>
              <div className="mt-3">
                <dt className="text-sm font-bold tabular-nums">
                  {formatCAD(
                    Math.max(0, projected.value - projected.contributed),
                  )}
                </dt>
                <dd className="text-xs text-[var(--text-muted)]">
                  Investment growth
                </dd>
              </div>
              <div className="mt-3">
                <dt className="text-sm font-bold">{annualReturn}%</dt>
                <dd className="text-xs text-[var(--text-muted)]">
                  Annual return (est.)
                </dd>
              </div>
            </dl>
          </div>
        </section>
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
              copy={`${formatCAD(projected.value)} is your estimated ${horizon}-year portfolio value at ${annualReturn}%.`}
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

      <section className="mt-3 rounded-[14px] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold">Contribution schedule</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Your planned contributions over time.
            </p>
          </div>
          <button
            onClick={() => { setEditing(true); window.setTimeout(() => document.getElementById('allocation-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }}
            className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)]"
          >
            Edit monthly allocation
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="bg-blue-50/70 text-[var(--text-muted)]">
              <tr>
                <th className="rounded-l-lg px-3 py-2 font-semibold">Month</th>
                {ACCOUNTS.map((account) => (
                  <th key={account.key} className="px-3 py-2 font-semibold">
                    {account.label}
                  </th>
                ))}
                <th className="px-3 py-2 font-semibold">Total</th>
                <th className="rounded-r-lg px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }, (_, index) => {
                const date = new Date();
                date.setDate(1);
                date.setMonth(date.getMonth() + index);
                const rowMonth = new Intl.DateTimeFormat("en-CA", {
                  month: "long",
                  year: "numeric",
                }).format(date);
                const isCurrent = index === 0;
                return (
                  <tr
                    key={rowMonth}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">
                      {rowMonth}
                    </td>
                    {rows.map((row) => (
                      <td
                        key={row.account}
                        className="px-3 py-2.5 tabular-nums"
                      >
                        {formatCAD(numeric(row.amount))}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 font-bold tabular-nums">
                      {formatCAD(allocated)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center gap-2 font-medium ${isCurrent ? "text-emerald-600" : "text-[var(--text-muted)]"}`}
                      >
                        <i
                          className={`h-2 w-2 rounded-full ${isCurrent ? "bg-emerald-400" : "bg-slate-300"}`}
                        />
                        {isCurrent ? "On track" : "Upcoming"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
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
