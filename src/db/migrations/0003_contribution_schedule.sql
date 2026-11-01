-- Apply after 0002_atomic_contributions.sql. Adds the monthly contribution cycle
-- and links each contribution to its stock, its holding and its instalment.

alter table public.contributions
  add column if not exists units numeric(14,4),
  add column if not exists price_native numeric(14,4),
  add column if not exists source text not null default 'manual'
    check (source in ('manual','auto','early')),
  add column if not exists cycle_due_on date;

create table if not exists public.contribution_schedules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day_of_month int not null check (day_of_month between 1 and 31),
  next_due date not null,
  paused boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per handled instalment. The unique key is what prevents a double contribution.
create table if not exists public.contribution_cycles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_on date not null,
  status text not null check (status in ('auto','early','manual','skipped')),
  note text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, due_on)
);

alter table public.contribution_schedules enable row level security;
alter table public.contribution_cycles enable row level security;
create policy "own contribution_schedules" on public.contribution_schedules for all using (auth.uid() = user_id);
create policy "own contribution_cycles" on public.contribution_cycles for all using (auth.uid() = user_id);

-- Applies one contribution: room, contribution row and holding together.
-- With p_cap, an amount over the available room is reduced to what fits;
-- otherwise it is rejected. Returns the amount actually applied.
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
      where user_id = owner and account = account_name and instrument_id = instrument order by id limit 1 for update;
    if holding_id is null then
      insert into public.holdings (user_id, instrument_id, account, units, balance_native, fx_rate)
      values (owner, instrument, account_name, line_units, coalesce(native, 0), coalesce(line_fx, 1));
    else
      update public.holdings set units = units + line_units, balance_native = balance_native + coalesce(native, 0) where id = holding_id;
    end if;
  end if;
  return amount;
end;
$$;

-- A purchase outside the schedule: an extra on top of the plan.
create or replace function public.record_purchase(p_line jsonb)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
begin
  return public.apply_contribution_line(p_line, 'manual', null, false);
end;
$$;

-- Removes a contribution, giving back its room and its holding units.
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
      where user_id = owner and account = row_.account and instrument_id = row_.instrument_id order by id limit 1 for update;
    if holding_id is not null then
      update public.holdings set units = greatest(units - row_.units, 0),
        balance_native = greatest(balance_native - coalesce(row_.amount_native, 0), 0) where id = holding_id;
    end if;
  end if;
  delete from public.contributions where id = p_id;
end;
$$;

-- Handles the next instalment exactly once. A second call for the same due date,
-- from another tab or a page load, finds next_due already moved and does nothing.
create or replace function public.resolve_cycle(p_due date, p_status text, p_lines jsonb, p_next_due date, p_note text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  current_due date;
  line jsonb;
  requested numeric := 0;
  applied numeric := 0;
  final_note text := p_note;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  if p_status not in ('auto','early','manual','skipped') then raise exception 'Invalid status'; end if;
  select next_due into current_due from public.contribution_schedules where user_id = owner for update;
  if not found or current_due <> p_due then return jsonb_build_object('applied', false); end if;

  insert into public.contribution_cycles (user_id, due_on, status, reviewed)
  values (owner, p_due, p_status, p_status <> 'auto');

  if p_status <> 'skipped' then
    for line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
      requested := requested + round((line->>'amount_cad')::numeric, 2);
      -- A manual entry holds the user's own figures, so it is never silently reduced.
      applied := applied + public.apply_contribution_line(line, p_status, p_due, p_status <> 'manual');
    end loop;
    if applied <= 0 then final_note := coalesce(final_note, 'Nothing recorded: no contribution room');
    elsif applied < requested then final_note := coalesce(final_note, 'Reduced to fit your contribution room'); end if;
  end if;

  update public.contribution_cycles set note = final_note where user_id = owner and due_on = p_due;
  update public.contribution_schedules set next_due = p_next_due where user_id = owner;
  return jsonb_build_object('applied', true, 'total', applied);
end;
$$;

-- Reverses a handled instalment. A latest instalment that is not yet due reopens;
-- an older or past one stays skipped so the next page load does not re-record it.
create or replace function public.undo_cycle(p_due date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  contribution_id bigint;
  today date := (now() at time zone 'America/Toronto')::date;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  perform 1 from public.contribution_schedules where user_id = owner for update;
  if not found then raise exception 'Schedule not found'; end if;
  perform 1 from public.contribution_cycles where user_id = owner and due_on = p_due;
  if not found then raise exception 'Instalment not found'; end if;

  for contribution_id in select id from public.contributions where user_id = owner and cycle_due_on = p_due loop
    perform public.delete_contribution(contribution_id);
  end loop;

  if p_due > today and not exists (select 1 from public.contribution_cycles where user_id = owner and due_on > p_due) then
    delete from public.contribution_cycles where user_id = owner and due_on = p_due;
    update public.contribution_schedules set next_due = p_due where user_id = owner;
  else
    update public.contribution_cycles set status = 'skipped', note = 'Undone', reviewed = true where user_id = owner and due_on = p_due;
  end if;
end;
$$;

revoke all on function public.apply_contribution_line(jsonb, text, date, boolean) from public, anon;
revoke all on function public.record_purchase(jsonb) from public, anon;
revoke all on function public.delete_contribution(bigint) from public, anon;
revoke all on function public.resolve_cycle(date, text, jsonb, date, text) from public, anon;
revoke all on function public.undo_cycle(date) from public, anon;
grant execute on function public.apply_contribution_line(jsonb, text, date, boolean) to authenticated;
grant execute on function public.record_purchase(jsonb) to authenticated;
grant execute on function public.delete_contribution(bigint) to authenticated;
grant execute on function public.resolve_cycle(date, text, jsonb, date, text) to authenticated;
grant execute on function public.undo_cycle(date) to authenticated;
