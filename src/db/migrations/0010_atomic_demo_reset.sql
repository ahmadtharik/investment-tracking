-- Resets the demo account in one transaction, so a failure part-way can't leave it
-- empty, and a visitor loading a page mid-reset never sees a half-seeded account.
-- Only the service role (the daily job) can call it.
create or replace function public.reset_demo_account(p_user uuid, p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.contributions where user_id = p_user;
  delete from public.holdings where user_id = p_user;
  delete from public.withdrawals where user_id = p_user;
  delete from public.account_alloc where user_id = p_user;
  delete from public.instrument_alloc where user_id = p_user;
  delete from public.fx_prefs where user_id = p_user;
  delete from public.contribution_cycles where user_id = p_user;
  delete from public.contribution_schedules where user_id = p_user;
  delete from public.room_events where user_id = p_user;
  delete from public.portfolio_snapshots where user_id = p_user;

  insert into public.profiles (id, monthly_income, monthly_expenses, emergency_fund, emergency_target, tfsa_room, rrsp_room)
  select p_user, monthly_income, monthly_expenses, emergency_fund, emergency_target, tfsa_room, rrsp_room
  from jsonb_populate_record(null::public.profiles, p_data->'profile')
  on conflict (id) do update set
    monthly_income = excluded.monthly_income, monthly_expenses = excluded.monthly_expenses,
    emergency_fund = excluded.emergency_fund, emergency_target = excluded.emergency_target,
    tfsa_room = excluded.tfsa_room, rrsp_room = excluded.rrsp_room;

  insert into public.account_alloc (user_id, account, pct)
  select p_user, account, pct from jsonb_populate_recordset(null::public.account_alloc, p_data->'accountAlloc');

  insert into public.instrument_alloc (user_id, account, instrument_id, pct)
  select p_user, account, instrument_id, pct from jsonb_populate_recordset(null::public.instrument_alloc, p_data->'instrumentAlloc');

  insert into public.holdings (user_id, instrument_id, account, units, balance_native, fx_rate, cost_cad)
  select p_user, instrument_id, account, units, balance_native, fx_rate, cost_cad
  from jsonb_populate_recordset(null::public.holdings, p_data->'holdings');

  insert into public.contributions (user_id, account, instrument_id, amount_cad, contributed_on, units, amount_native, price_native, fx_rate, source, cycle_due_on)
  select p_user, account, instrument_id, amount_cad, contributed_on, units, amount_native, price_native, fx_rate, source, cycle_due_on
  from jsonb_populate_recordset(null::public.contributions, p_data->'contributions');

  insert into public.contribution_cycles (user_id, due_on, status, reviewed)
  select p_user, due_on, status, reviewed from jsonb_populate_recordset(null::public.contribution_cycles, p_data->'cycles');

  insert into public.contribution_schedules (user_id, day_of_month, next_due, paused)
  select p_user, day_of_month, next_due, paused from jsonb_populate_record(null::public.contribution_schedules, p_data->'schedule');

  insert into public.portfolio_snapshots (user_id, snapshot_on, value_cad)
  select p_user, snapshot_on, value_cad from jsonb_populate_recordset(null::public.portfolio_snapshots, p_data->'snapshots');
end;
$$;

revoke all on function public.reset_demo_account(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.reset_demo_account(uuid, jsonb) to service_role;

-- Yahoo returns a live bar dated today after each month's own bar, and earlier
-- code saved one of these on every day it fetched. Keep one bar per month.
delete from public.price_cache as extra
using public.price_cache as first
where first.ticker = extra.ticker
  and date_trunc('month', first.price_date) = date_trunc('month', extra.price_date)
  and first.price_date < extra.price_date;
