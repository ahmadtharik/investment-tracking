-- Apply after 0001_init.sql. Records the deposit and room deduction together.
create or replace function public.record_contribution(p_contribution jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  account_name text := p_contribution->>'account';
  amount numeric := (p_contribution->>'amount_cad')::numeric;
  available numeric;
  remaining numeric;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  if amount is null or amount <= 0 or amount != round(amount, 2) then raise exception 'Enter a positive CAD amount with at most two decimals'; end if;
  if account_name is null or account_name not in ('TFSA', 'RRSP', 'CASH') then raise exception 'Invalid account'; end if;
  if account_name in ('TFSA', 'RRSP') then
    select case when account_name = 'TFSA' then tfsa_room else rrsp_room end into available
      from public.profiles where id = owner for update;
    if not found then raise exception 'Profile not found'; end if;
    if amount > available then raise exception 'Contribution exceeds available room'; end if;
    remaining := available - amount;
    if account_name = 'TFSA' then update public.profiles set tfsa_room = remaining where id = owner;
    else update public.profiles set rrsp_room = remaining where id = owner; end if;
  end if;
  insert into public.contributions (user_id, account, instrument_id, amount_cad, contributed_on, fx_provider, fx_rate, fx_cost_cad, amount_native)
  values (owner, account_name, (p_contribution->>'instrument_id')::bigint, amount,
    (p_contribution->>'contributed_on')::date, p_contribution->>'fx_provider',
    (p_contribution->>'fx_rate')::numeric, (p_contribution->>'fx_cost_cad')::numeric,
    (p_contribution->>'amount_native')::numeric);
  return case when remaining is null then '{}'::jsonb else jsonb_build_object('remainingRoom', remaining) end;
end;
$$;
revoke all on function public.record_contribution(jsonb) from public, anon;
grant execute on function public.record_contribution(jsonb) to authenticated;
