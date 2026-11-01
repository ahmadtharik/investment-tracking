-- Apply after 0004_security_and_names.sql. Adds purchase cost to holdings, makes
-- each stock appear once per account, and allows contributions to be edited.

-- Null means the cost isn't known, such as holdings entered before this column.
alter table public.holdings add column if not exists cost_cad numeric(14,2);

-- Merge existing duplicates into the oldest row before enforcing one per account.
update public.holdings keeper set
  units = totals.units,
  balance_native = totals.balance_native
from (
  select min(id) as id, sum(units) as units, sum(balance_native) as balance_native
  from public.holdings group by user_id, account, instrument_id having count(*) > 1
) totals
where keeper.id = totals.id;

delete from public.holdings duplicate using public.holdings keeper
where duplicate.user_id = keeper.user_id and duplicate.account = keeper.account
  and duplicate.instrument_id = keeper.instrument_id and duplicate.id > keeper.id;

alter table public.holdings add constraint holdings_one_per_account unique (user_id, account, instrument_id);

create or replace function public.apply_contribution_line(p_line jsonb, p_source text, p_due date, p_cap boolean)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  account_name text := p_line->>'account';
  requested numeric := round((p_line->>'amount_cad')::numeric, 2);
  amount numeric := requested;
  instrument bigint := (p_line->>'instrument_id')::bigint;
  line_units numeric := (p_line->>'units')::numeric;
  native numeric := (p_line->>'amount_native')::numeric;
  line_fx numeric := (p_line->>'fx_rate')::numeric;
  available numeric;
  holding_id bigint;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  if amount is null or amount <= 0 then raise exception 'Enter a positive CAD amount'; end if;
  if account_name is null or account_name not in ('TFSA', 'RRSP', 'CASH') then raise exception 'Invalid account'; end if;

  if account_name in ('TFSA', 'RRSP') then
    select case when account_name = 'TFSA' then tfsa_room else rrsp_room end into available
      from public.profiles where id = owner for update;
    if not found then raise exception 'Profile not found'; end if;
    if amount > available then
      if not p_cap then raise exception 'Contribution exceeds available room'; end if;
      amount := greatest(available, 0);
      if amount <= 0 then return 0; end if;
      line_units := line_units * amount / requested;
      native := native * amount / requested;
    end if;
    if account_name = 'TFSA' then update public.profiles set tfsa_room = tfsa_room - amount where id = owner;
    else update public.profiles set rrsp_room = rrsp_room - amount where id = owner; end if;
  end if;

  insert into public.contributions (user_id, account, instrument_id, amount_cad, contributed_on, fx_rate, amount_native, units, price_native, source, cycle_due_on)
  values (owner, account_name, instrument, amount, (p_line->>'contributed_on')::date, line_fx, native, line_units,
    (p_line->>'price_native')::numeric, p_source, p_due);

  if instrument is not null and line_units is not null then
    select id into holding_id from public.holdings
      where user_id = owner and account = account_name and instrument_id = instrument for update;
    if holding_id is null then
      insert into public.holdings (user_id, instrument_id, account, units, balance_native, fx_rate, cost_cad)
      values (owner, instrument, account_name, line_units, coalesce(native, 0), coalesce(line_fx, 1), amount);
    else
      -- An unknown cost stays unknown: adding to it would understate the true cost.
      update public.holdings set units = units + line_units, balance_native = balance_native + coalesce(native, 0),
        cost_cad = cost_cad + amount where id = holding_id;
    end if;
  end if;
  return amount;
end;
$$;

create or replace function public.delete_contribution(p_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  row_ public.contributions%rowtype;
  holding_id bigint;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  select * into row_ from public.contributions where id = p_id and user_id = owner for update;
  if not found then raise exception 'Contribution not found'; end if;
  if row_.account = 'TFSA' then update public.profiles set tfsa_room = tfsa_room + row_.amount_cad where id = owner;
  elsif row_.account = 'RRSP' then update public.profiles set rrsp_room = rrsp_room + row_.amount_cad where id = owner; end if;
  if row_.instrument_id is not null and row_.units is not null then
    select id into holding_id from public.holdings
      where user_id = owner and account = row_.account and instrument_id = row_.instrument_id for update;
    if holding_id is not null then
      update public.holdings set units = greatest(units - row_.units, 0),
        balance_native = greatest(balance_native - coalesce(row_.amount_native, 0), 0),
        -- greatest() ignores nulls, so keep an unknown cost from turning into 0.
        cost_cad = case when cost_cad is null then null else greatest(cost_cad - row_.amount_cad, 0) end where id = holding_id;
      delete from public.holdings where id = holding_id and units = 0 and balance_native = 0;
    end if;
  end if;
  delete from public.contributions where id = p_id;
end;
$$;

-- Reverses and re-applies in one transaction, keeping the instalment link.
create or replace function public.update_contribution(p_id bigint, p_line jsonb)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  row_ public.contributions%rowtype;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  select * into row_ from public.contributions where id = p_id and user_id = owner;
  if not found then raise exception 'Contribution not found'; end if;
  perform public.delete_contribution(p_id);
  return public.apply_contribution_line(p_line, row_.source, row_.cycle_due_on, false);
end;
$$;

revoke all on function public.update_contribution(bigint, jsonb) from public, anon;
grant execute on function public.update_contribution(bigint, jsonb) to authenticated;
