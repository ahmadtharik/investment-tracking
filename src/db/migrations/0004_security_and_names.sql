-- Apply after 0003_contribution_schedule.sql.
-- The market-data caches are written only by server routes using the service role,
-- which bypasses row level security. With no policies, public clients get no access.
alter table public.quote_cache enable row level security;
alter table public.price_cache enable row level security;

-- Correct mislabelled starter instruments. Names only: tickers are unchanged.
update public.instruments set name = 'BMO Aggregate Bond Index ETF' where ticker = 'ZAG.TO';
update public.instruments set name = 'Vanguard Total Stock Market ETF' where ticker = 'VTI';
update public.instruments set name = 'Vanguard U.S. Total Market Index ETF (CAD-hedged)' where ticker = 'VUS.CN';
update public.instruments set name = 'Vanguard U.S. Total Market Index ETF' where ticker = 'VUN.CN';
