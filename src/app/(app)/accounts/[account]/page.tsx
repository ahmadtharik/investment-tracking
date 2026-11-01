import Link from 'next/link';
import { notFound } from 'next/navigation';
import { authGuard } from '@/lib/supabase/middleware';
import { serverSupabase } from '@/lib/supabase/server';
import { getContributions, getHoldings, getOrCreateProfile, listInstruments } from '@/lib/db/queries';
import { roomSummary } from '@/lib/engine/plan';
import { todayInToronto } from '@/lib/engine/schedule';
import { getQuotes } from '@/lib/market/yahoo';
import { settleDueCycles } from '@/lib/schedule/settle';
import { gainCad, holdingValueCad, valuationTickers } from '@/lib/valuation';
import { formatCAD } from '@/lib/format';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const ACCOUNTS = { TFSA: 'TFSA', RRSP: 'RRSP', CASH: 'Cash' } as const;

export default async function AccountPage({ params }: { params: Promise<{ account: string }> }) {
  const { account } = await params;
  if (!(account in ACCOUNTS)) notFound();
  const key = account as keyof typeof ACCOUNTS;
  const user = await authGuard();
  const db = await serverSupabase();
  await settleDueCycles(db, user.id);
  const [profile, allContributions, allHoldings, instruments] = await Promise.all([getOrCreateProfile(db, user.id), getContributions(db, user.id), getHoldings(db, user.id), listInstruments(db)]);
  const holdings = allHoldings.filter((holding) => holding.account === key);
  const contributions = allContributions.filter((item) => item.account === key).reverse();
  let quotes: Record<string, { price: number }> = {};
  try { quotes = await getQuotes(valuationTickers(holdings)); } catch { /* Recorded balances are the fallback. */ }
  const year = todayInToronto().slice(0, 4);
  const contributedThisYear = contributions.filter((item) => item.contributed_on.startsWith(year)).reduce((sum, item) => sum + item.amount_cad, 0);
  const total = holdings.reduce((sum, holding) => sum + holdingValueCad(holding, quotes), 0);
  const room = key === 'CASH' ? null : roomSummary(key === 'TFSA' ? profile.tfsa_room : profile.rrsp_room, contributedThisYear);
  const totalGain = gainCad(holdings, quotes);
  const gainText = (gain: { gain: number } | null) => gain ? `${gain.gain >= 0 ? '+' : ''}${formatCAD(gain.gain)}` : '—';
  const stats = [
    { label: 'Current value', value: formatCAD(total) },
    { label: `Contributed in ${year}`, value: formatCAD(contributedThisYear) },
    ...(room ? [{ label: 'Available room', value: room.over > 0 ? `Over by ${formatCAD(room.over)}` : formatCAD(room.available) }, { label: `${year} limit`, value: formatCAD(room.limit) }] : [{ label: 'Gain/Loss', value: gainText(totalGain) }]),
  ];
  return <div className="mx-auto w-full max-w-[1276px] pb-8">
    <Link href="/accounts" className="text-xs font-semibold text-[var(--color-primary)]">← Accounts overview</Link>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><h1 className="text-[28px] font-bold tracking-tight">{ACCOUNTS[key]}</h1><Link href={`/accounts/manage?account=${key}#record-contribution`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Log contribution</Link></div>
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <Card key={stat.label} className="!p-4"><p className="text-sm text-[var(--text-muted)]">{stat.label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p></Card>)}</section>
    <Card className="mt-3 !p-4 sm:!p-5" title="Holdings">{holdings.length === 0 ? <p className="py-6 text-center text-sm text-[var(--text-muted)]">No holdings in this account.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs text-[var(--text-muted)]"><tr><th className="py-2 font-medium">Investment</th><th className="py-2 font-medium">Units</th><th className="py-2 font-medium">Current value</th><th className="py-2 text-right font-medium">Gain/Loss</th></tr></thead><tbody>{holdings.map((holding) => <tr key={holding.id} className="border-t border-[var(--border)]"><td className="py-2 font-medium">{holding.ticker}</td><td className="py-2 tabular-nums">{holding.units}</td><td className="py-2 tabular-nums">{formatCAD(holdingValueCad(holding, quotes))}</td><td className="py-2 text-right tabular-nums">{gainText(gainCad([holding], quotes))}</td></tr>)}</tbody></table></div>}<Link href="/portfolio" className="mt-3 inline-block text-xs font-semibold text-[var(--color-primary)]">Edit in Portfolio →</Link></Card>
    <Card className="mt-3 !p-4 sm:!p-5" title="Contributions">{contributions.length === 0 ? <p className="py-6 text-center text-sm text-[var(--text-muted)]">No contributions yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-[var(--text-muted)]"><tr><th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Investment</th><th className="py-2 text-right font-medium">Amount</th></tr></thead><tbody>{contributions.map((item) => <tr key={item.id} className="border-t border-[var(--border)]"><td className="py-2">{item.contributed_on}</td><td className="py-2">{instruments.find((i) => i.id === item.instrument_id)?.ticker ?? '—'}</td><td className="py-2 text-right tabular-nums">{formatCAD(item.amount_cad)}</td></tr>)}</tbody></table></div>}<Link href={`/accounts/manage?account=${key}#record-contribution`} className="mt-3 inline-block text-xs font-semibold text-[var(--color-primary)]">Edit or delete in Manage →</Link></Card>
  </div>;
}
