-- Investment Planner — initial schema
-- Run in the Supabase SQL editor (or: supabase db execute --linked <this file>)

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  monthly_income numeric(12,2) not null default 0,
  monthly_expenses numeric(12,2) not null default 0,
  emergency_fund numeric(12,2) not null default 0,
  emergency_target numeric(12,2) not null default 0,
  tfsa_room numeric(12,2) not null default 109000,
  rrsp_room numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists instruments (
  id bigint generated always as identity primary key,
  ticker text not null unique,           -- Yahoo symbol: XEQT.TO, VTI
  name text not null,
  currency text not null default 'CAD',  -- CAD or USD
  asset_class text not null default 'ETF'
);

create table if not exists account_alloc (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null check (account in ('TFSA','RRSP','CASH')),
  pct numeric(5,4) not null check (pct >= 0 and pct <= 1),
  unique (user_id, account)
);

create table if not exists instrument_alloc (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null check (account in ('TFSA','RRSP')),
  instrument_id bigint not null references instruments(id),
  pct numeric(5,4) not null check (pct >= 0 and pct <= 1),
  unique (user_id, account, instrument_id)
);

create table if not exists holdings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id bigint not null references instruments(id),
  account text not null check (account in ('TFSA','RRSP','CASH')),
  units numeric(14,4) not null default 0,          -- units of the instrument
  balance_native numeric(14,2) not null default 0, -- in instrument currency
  fx_provider text not null default 'TD' check (fx_provider in ('TD','WEALTHSIMPLE','CUSTOM')),
  fx_rate numeric(10,6) not null default 1,        -- CAD per 1 native unit (1 for CAD instruments)
  created_at timestamptz not null default now()
);

create table if not exists contributions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null check (account in ('TFSA','RRSP','CASH')),
  instrument_id bigint references instruments(id), -- null for cash
  amount_cad numeric(12,2) not null,
  fx_provider text,
  fx_rate numeric(10,6),
  fx_cost_cad numeric(12,2),
  amount_native numeric(12,2),
  contributed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists withdrawals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null check (account in ('TFSA','RRSP')),
  amount_cad numeric(12,2) not null,
  withdrawn_on date not null default current_date,
  room_restored_in int,                -- e.g. 2027 for a 2026 TFSA withdrawal
  created_at timestamptz not null default now()
);

create table if not exists fx_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  provider text not null check (provider in ('TD','WEALTHSIMPLE','CUSTOM')),
  custom_rate numeric(10,6),
  primary key (user_id, ticker)
);

-- Market-data caches (written by API routes with the service role key)
create table if not exists quote_cache (
  ticker text primary key,
  price numeric(14,4) not null,
  currency text not null,
  as_of timestamptz not null
);

create table if not exists price_cache (
  ticker text not null,
  price_date date not null,
  close numeric(14,4) not null,
  primary key (ticker, price_date)
);

-- ── Row level security ────────────────────────────────────────────────
alter table profiles enable row level security;
alter table account_alloc enable row level security;
alter table instrument_alloc enable row level security;
alter table holdings enable row level security;
alter table contributions enable row level security;
alter table withdrawals enable row level security;
alter table fx_prefs enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own account_alloc" on account_alloc for all using (auth.uid() = user_id);
create policy "own instrument_alloc" on instrument_alloc for all using (auth.uid() = user_id);
create policy "own holdings" on holdings for all using (auth.uid() = user_id);
create policy "own contributions" on contributions for all using (auth.uid() = user_id);
create policy "own withdrawals" on withdrawals for all using (auth.uid() = user_id);
create policy "own fx_prefs" on fx_prefs for all using (auth.uid() = user_id);

-- instruments is global reference data: readable by any authenticated user
alter table instruments enable row level security;
create policy "instruments readable" on instruments for select using (auth.role() = 'authenticated');

-- ── Seed instruments (Yahoo symbols; currency is quote currency) ─────
insert into instruments (ticker, name, currency, asset_class) values
  ('XEQT.TO','iShares All-Equity ETF','CAD','ETF'),
  ('ZAG.TO','BMO Aggressive Allocation ETF','CAD','ETF'),
  ('XIHT.TO','iShares S&P/TSX 60 Index ETF','CAD','ETF'),
  ('VTI','Vanguard Total World Stock ETF','USD','ETF'),
  ('VUS.CN','iShares Core S&P U.S. Total Market Index ETF','CAD','ETF'),
  ('VUN.CN','iShares Core MSCI Emerging Markets IMI Index ETF','CAD','ETF')
on conflict (ticker) do nothing;
