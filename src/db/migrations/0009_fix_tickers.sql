-- Correct starter tickers that Yahoo Finance doesn't recognize. Instrument ids don't change, so holdings keep their links.
with renamed (old_ticker, new_ticker) as (
  values ('VUS.CN', 'VUS.TO'), ('VUN.CN', 'VUN.TO'), ('XIHT.TO', 'XIU.TO')
)
update public.instruments as instrument set ticker = renamed.new_ticker
from renamed
where instrument.ticker = renamed.old_ticker
  and not exists (select 1 from public.instruments as taken where taken.ticker = renamed.new_ticker);

with renamed (old_ticker, new_ticker) as (
  values ('VUS.CN', 'VUS.TO'), ('VUN.CN', 'VUN.TO'), ('XIHT.TO', 'XIU.TO')
)
update public.fx_prefs as pref set ticker = renamed.new_ticker
from renamed
where pref.ticker = renamed.old_ticker
  and not exists (select 1 from public.fx_prefs as taken where taken.user_id = pref.user_id and taken.ticker = renamed.new_ticker);

delete from public.quote_cache where ticker in ('VUS.CN', 'VUN.CN', 'XIHT.TO');
delete from public.price_cache where ticker in ('VUS.CN', 'VUN.CN', 'XIHT.TO');
