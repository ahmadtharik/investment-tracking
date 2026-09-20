"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { clientSupabase } from "@/lib/supabase/client";
import {
  deleteHolding,
  getHoldings,
  upsertHolding,
  type HoldingWithInstrument,
  type InstrumentRow,
} from "@/lib/db/queries";
import { formatCAD, formatUSD } from "@/lib/format";

type Quote = { price: number; currency: string; asOf?: string };
type Result = { ticker: string; name: string };
type Account = "TFSA" | "RRSP" | "CASH";
type Draft = {
  id?: number;
  instrument_id: number;
  account: Account;
  units: string;
  balance_native: string;
  fx_provider: string;
  fx_rate: string;
};
type Mutation = "instrument" | "save" | "delete" | null;
type Props = {
  userId: string;
  instruments: InstrumentRow[];
  holdings: HoldingWithInstrument[];
  quotes: Record<string, Quote>;
  onChanged: (holdings: HoldingWithInstrument[]) => void;
};

const emptyDraft = (instrument_id: number): Draft => ({
  instrument_id,
  account: "TFSA",
  units: "",
  balance_native: "",
  fx_provider: "TD",
  fx_rate: "1",
});
const valueFor = (h: HoldingWithInstrument, quote?: Quote) =>
  (quote ? h.units * quote.price : h.balance_native) *
  (h.currency === "USD" ? h.fx_rate : 1);

export function HoldingsForm({
  userId,
  instruments: initialInstruments,
  holdings: initialHoldings,
  quotes,
  onChanged,
}: Props) {
  const [instruments, setInstruments] = useState(initialInstruments);
  const [holdings, setHoldings] = useState(initialHoldings);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCurrency, setManualCurrency] = useState<"CAD" | "USD">("CAD");
  const [mutation, setMutation] = useState<Mutation>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const selected = useMemo(
    () => instruments.find((i) => i.id === draft?.instrument_id),
    [instruments, draft],
  );
  const local = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? instruments
          .filter(
            (i) =>
              i.ticker.toLowerCase().includes(q) ||
              i.name.toLowerCase().includes(q),
          )
          .slice(0, 8)
          .map((i) => ({ ticker: i.ticker, name: i.name }))
      : [];
  }, [instruments, search]);
  const combined = [
    ...local,
    ...results.filter((r) => !local.some((x) => x.ticker === r.ticker)),
  ];
  const hasMutation = mutation !== null;

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/market/search?q=${encodeURIComponent(q)}`,
        );
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Search unavailable");
        setResults(data.results ?? []);
        setSearchError(null);
      } catch (error) {
        setResults([]);
        setSearchError(
          error instanceof Error ? error.message : "Search unavailable",
        );
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const ticker = selected?.ticker;
    if (!ticker) {
      setPreviewQuote(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/market/quotes?tickers=${encodeURIComponent(ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setPreviewQuote(data?.quotes?.[ticker] ?? null);
      })
      .catch(() => {
        if (!cancelled) setPreviewQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.ticker]);

  const choose = (id: number) => {
    const i = instruments.find((x) => x.id === id);
    setDraft((d) =>
      d
        ? {
            ...d,
            instrument_id: id,
            fx_rate: i?.currency === "USD" ? "1.36" : "1",
          }
        : d,
    );
    setSearch("");
    setResults([]);
    setManual(false);
  };

  async function chooseResult(result: Result, currency?: "CAD" | "USD") {
    const existing = instruments.find((i) => i.ticker === result.ticker);
    if (existing) {
      choose(existing.id);
      return;
    }
    setMutation("instrument");
    setMessage(null);
    try {
      const response = await fetch("/api/market/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: result.ticker,
          name: result.name,
          currency:
            currency ??
            (result.ticker.endsWith(".TO") || result.ticker.endsWith(".CN")
              ? "CAD"
              : "USD"),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not save instrument");
      setInstruments((all) => [...all, data.instrument]);
      choose(data.instrument.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save instrument",
      );
    } finally {
      setMutation(null);
    }
  }

  function edit(h: HoldingWithInstrument) {
    setDraft({
      id: h.id,
      instrument_id: h.instrument_id,
      account: h.account as Account,
      units: String(h.units),
      balance_native: String(h.balance_native),
      fx_provider: h.fx_provider,
      fx_rate: String(h.fx_rate),
    });
  }

  const router = useRouter();
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setMutation("save");
    setMessage(null);
    try {
      const instrument = instruments.find((i) => i.id === draft.instrument_id);
      if (!instrument) throw new Error("Choose an instrument");
      const fields = {
        instrument_id: draft.instrument_id,
        account: draft.account,
        units: Number(draft.units) || 0,
        balance_native: Number(draft.balance_native) || 0,
        fx_provider: draft.fx_provider,
        fx_rate: Number(draft.fx_rate) || 1,
      };
      if (!Number.isFinite(fields.units) || fields.units < 0 || !Number.isFinite(fields.balance_native) || fields.balance_native < 0 || !Number.isFinite(fields.fx_rate) || fields.fx_rate <= 0) throw new Error('Enter non-negative holdings and a positive exchange rate.');
      await upsertHolding(
        clientSupabase(),
        userId,
        draft.id ? { ...fields, id: draft.id } : fields,
      );
      const next = await getHoldings(clientSupabase(), userId);
      setHoldings(next);
      onChanged(next);
      setDraft(null);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save holding",
      );
    } finally {
      setMutation(null);
    }
  }

  async function remove(h: HoldingWithInstrument) {
    if (!window.confirm(`Delete ${h.ticker} holding?`)) return;
    setMutation("delete");
    setDeletingId(h.id);
    setMessage(null);
    try {
      await deleteHolding(clientSupabase(), userId, h.id);
      const next = holdings.filter((x) => x.id !== h.id);
      setHoldings(next);
      onChanged(next);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not delete holding",
      );
    } finally {
      setMutation(null);
      setDeletingId(null);
    }
  }

  const manualTicker = search.trim().toUpperCase();
  const currentQuote = selected
    ? (quotes[selected.ticker] ?? previewQuote)
    : null;
  const updateDraft = (field: keyof Draft, value: string) =>
    setDraft((d) => ({
      ...(d ?? emptyDraft(instruments[0]?.id ?? 0)),
      [field]: value,
    }));

  return (
    <div className="space-y-6">
      <Card
        title="Holdings"
        description="A record of investments you already own, not planned monthly purchases."
      >
        <p className="mb-4 text-xs text-zinc-500">
          Add or update a holding after a real purchase. It does not change
          contribution room automatically; record your contribution separately
          so it matches your CRA and brokerage records.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="pb-2">Instrument</th>
                <th className="pb-2">Account</th>
                <th className="pb-2">Units</th>
                <th className="pb-2">Native balance</th>
                <th className="pb-2">Live CAD value</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-3">
                    <div className="font-medium">{h.ticker}</div>
                    <div className="text-xs text-zinc-500">{h.name}</div>
                  </td>
                  <td>{h.account}</td>
                  <td className="tabular-nums">{h.units.toLocaleString()}</td>
                  <td className="tabular-nums">
                    {h.currency === "USD"
                      ? formatUSD(h.balance_native)
                      : formatCAD(h.balance_native)}
                  </td>
                  <td className="tabular-nums">
                    {formatCAD(valueFor(h, quotes[h.ticker]))}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => edit(h)}
                        disabled={hasMutation}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => remove(h)}
                        disabled={hasMutation && deletingId !== h.id}
                        loading={mutation === "delete" && deletingId === h.id}
                        loadingLabel="Deleting…"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {holdings.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">
              No holdings yet. Add an investment after you make a purchase.
            </p>
          )}
        </div>
      </Card>
      <Card title={draft?.id ? "Edit holding" : "Add holding"}>
        {message && (
          <p className="mb-3 rounded-md bg-red-50 p-2 text-sm text-red-700">
            {message}
          </p>
        )}
        <form
          onSubmit={save}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Instrument">
            <div className="relative">
              <Input
                value={search || selected?.ticker || ""}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setManual(false);
                  if (!draft) setDraft(emptyDraft(instruments[0]?.id ?? 0));
                }}
                placeholder="Search ticker or name"
                required
              />
              {(combined.length > 0 || searching || searchError) && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg">
                  {searching && (
                    <p className="px-3 py-2 text-sm text-zinc-500">
                      Searching local instruments and Yahoo...
                    </p>
                  )}
                  {combined.map((r) => (
                    <button
                      type="button"
                      key={r.ticker}
                      className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[#f3f0e9]"
                      onClick={() => chooseResult(r)}
                      disabled={hasMutation}
                    >
                      <span className="font-medium">{r.ticker}</span>
                      <span className="ml-2 text-zinc-500">{r.name}</span>
                    </button>
                  ))}
                  {searchError && (
                    <p className="px-3 py-2 text-xs text-amber-700">
                      Yahoo search unavailable. Add the ticker manually below.
                    </p>
                  )}
                  <button
                    type="button"
                    className="w-full border-t border-[var(--line)] px-3 py-2 text-left text-sm font-medium text-[var(--accent)]"
                    onClick={() => {
                      setManual(true);
                      setManualName(search.trim());
                    }}
                    disabled={hasMutation}
                  >
                    Add ticker manually
                  </button>
                </div>
              )}
            </div>
          </Field>
          {manual && (
            <>
              <Field label="Manual name">
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Instrument or company name"
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={manualCurrency}
                  onChange={(e) =>
                    setManualCurrency(e.target.value as "CAD" | "USD")
                  }
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </Select>
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={() =>
                    chooseResult(
                      {
                        ticker: manualTicker,
                        name: manualName.trim() || manualTicker,
                      },
                      manualCurrency,
                    )
                  }
                  disabled={hasMutation || !manualTicker}
                  loading={mutation === "instrument"}
                  loadingLabel="Adding instrument…"
                >
                  Use this instrument
                </Button>
              </div>
            </>
          )}
          <Field label="Account">
            <Select
              value={draft?.account ?? "TFSA"}
              onChange={(e) =>
                updateDraft("account", e.target.value as Account)
              }
            >
              <option>TFSA</option>
              <option>RRSP</option>
              <option>CASH</option>
            </Select>
          </Field>
          <Field
            label="Units"
            hint="Number of shares or fund units you currently own."
          >
            <Input
              type="number"
              min="0"
              step="0.0001"
              value={draft?.units ?? ""}
              onChange={(e) => updateDraft("units", e.target.value)}
              required
            />
          </Field>
          <Field
            label={
              <span>
                Native balance{" "}
                <InfoTooltip>
                  Recorded balance or value in the instrument currency. It is
                  used as a fallback when a live quote is unavailable; it is not
                  necessarily your cost basis or current value.
                </InfoTooltip>
              </span>
            }
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft?.balance_native ?? ""}
              onChange={(e) => updateDraft("balance_native", e.target.value)}
            />
          </Field>
          {selected && (
            <Field label="Current price">
              <Input
                readOnly
                aria-label="Current price"
                value={
                  currentQuote
                    ? `${currentQuote.currency === "USD" ? "US$" : "$"}${currentQuote.price.toLocaleString("en-CA", { maximumFractionDigits: 4 })}`
                    : "Checking latest quote…"
                }
              />
            </Field>
          )}
          {selected?.currency === "USD" && (
            <>
              <Field label="FX provider">
                <Select
                  value={draft?.fx_provider ?? "TD"}
                  onChange={(e) => updateDraft("fx_provider", e.target.value)}
                >
                  <option value="TD">TD</option>
                  <option value="WEALTHSIMPLE">Wealthsimple</option>
                  <option value="CUSTOM">Custom</option>
                </Select>
              </Field>
              <Field label="FX rate CAD per USD">
                <Input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={draft?.fx_rate ?? "1.36"}
                  onChange={(e) => updateDraft("fx_rate", e.target.value)}
                />
              </Field>
            </>
          )}
          <div className="flex w-full flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
            <Button
              type="submit"
              disabled={hasMutation || !draft?.instrument_id}
              loading={mutation === "save"}
              loadingLabel={draft?.id ? "Saving…" : "Adding…"}
            >
              {draft?.id ? "Save changes" : "Add holding"}
            </Button>
            {draft?.id && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDraft(null)}
                disabled={hasMutation}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
