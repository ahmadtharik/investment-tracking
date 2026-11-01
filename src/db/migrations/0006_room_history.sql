-- Apply after 0005_holding_cost_and_edit.sql. Records why contribution room changed,
-- restores TFSA room from withdrawals, and allows a confirmed over-contribution.

create table if not exists public.room_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account text not null check (account in ('TFSA','RRSP')),
  kind text not null check (kind in ('new_limit','restored','adjustment')),
  amount_cad numeric(12,2) not null,
  effective_on date not null default ((now() at time zone 'America/Toronto')::date),
  note text,
  created_at timestamptz not null default now()
);
alter table public.room_events enable row level security;
create policy "own room_events" on public.room_events for all using (auth.uid() = user_id);

-- Past restoration years are assumed to be in the room figure the user already entered.
alter table public.withdrawals add column if not exists restored boolean not null default false;
update public.withdrawals set restored = true
  where room_restored_in <= extract(year from (now() at time zone 'America/Toronto'))::int;

create or replace function public.add_room(p_account text, p_amount numeric, p_kind text, p_note text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
begin
  if owner is null then raise exception 'Sign in required'; end if;
  if p_account not in ('TFSA','RRSP') then raise exception 'Invalid account'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Enter an amount'; end if;
  if p_account = 'TFSA' then update public.profiles set tfsa_room = tfsa_room + p_amount where id = owner;
  else update public.profiles set rrsp_room = rrsp_room + p_amount where id = owner; end if;
  insert into public.room_events (user_id, account, kind, amount_cad, note) values (owner, p_account, p_kind, p_amount, p_note);
end;
$$;

-- Saves corrected room figures, logging only the difference.
create or replace function public.set_room(p_tfsa numeric, p_rrsp numeric)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  old_tfsa numeric;
  old_rrsp numeric;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  select tfsa_room, rrsp_room into old_tfsa, old_rrsp from public.profiles where id = owner for update;
  if not found then raise exception 'Profile not found'; end if;
  if p_tfsa <> old_tfsa then perform public.add_room('TFSA', p_tfsa - old_tfsa, 'adjustment', 'Room corrected'); end if;
  if p_rrsp <> old_rrsp then perform public.add_room('RRSP', p_rrsp - old_rrsp, 'adjustment', 'Room corrected'); end if;
end;
$$;

-- Adds room from TFSA withdrawals whose restoration year has arrived, once each.
create or replace function public.apply_room_restorations()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  this_year int := extract(year from (now() at time zone 'America/Toronto'))::int;
  row_ public.withdrawals%rowtype;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  for row_ in select * from public.withdrawals
    where user_id = owner and account = 'TFSA' and not restored and room_restored_in <= this_year for update loop
    perform public.add_room('TFSA', row_.amount_cad, 'restored', 'Withdrawal on ' || row_.withdrawn_on);
    update public.withdrawals set restored = true where id = row_.id;
  end loop;
end;
$$;

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
      if p_cap then
        amount := greatest(available, 0);
        if amount <= 0 then return 0; end if;
        line_units := line_units * amount / requested;
        native := native * amount / requested;
      -- Only a person can decide to go over: automatic entries always take the cap path above.
      elsif not coalesce((p_line->>'allow_over')::boolean, false) then
        raise exception 'Contribution exceeds available room';
      end if;
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

revoke all on function public.add_room(text, numeric, text, text) from public, anon;
revoke all on function public.set_room(numeric, numeric) from public, anon;
revoke all on function public.apply_room_restorations() from public, anon;
grant execute on function public.add_room(text, numeric, text, text) to authenticated;
grant execute on function public.set_room(numeric, numeric) to authenticated;
grant execute on function public.apply_room_restorations() to authenticated;
