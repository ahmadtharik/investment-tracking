-- Apply after 0007_portfolio_snapshots.sql. Lets the daily server job act for a user.
-- The existing functions identify the user through auth.uid(), which reads the request
-- claims, so these wrappers set those claims for this transaction only.
-- Only the service role can call them: never grant these to signed-in users.

create or replace function public.act_as(p_user uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_user is null then raise exception 'User required'; end if;
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
end;
$$;

create or replace function public.resolve_cycle_as(p_user uuid, p_due date, p_status text, p_lines jsonb, p_next_due date, p_note text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.act_as(p_user);
  return public.resolve_cycle(p_due, p_status, p_lines, p_next_due, p_note);
end;
$$;

create or replace function public.apply_room_restorations_as(p_user uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.act_as(p_user);
  perform public.apply_room_restorations();
end;
$$;

revoke all on function public.act_as(uuid) from public, anon, authenticated;
revoke all on function public.resolve_cycle_as(uuid, date, text, jsonb, date, text) from public, anon, authenticated;
revoke all on function public.apply_room_restorations_as(uuid) from public, anon, authenticated;

grant execute on function public.act_as(uuid) to service_role;
grant execute on function public.resolve_cycle_as(uuid, date, text, jsonb, date, text) to service_role;
grant execute on function public.apply_room_restorations_as(uuid) to service_role;
grant execute on function public.resolve_cycle(date, text, jsonb, date, text) to service_role;
grant execute on function public.apply_contribution_line(jsonb, text, date, boolean) to service_role;
grant execute on function public.apply_room_restorations() to service_role;
grant execute on function public.add_room(text, numeric, text, text) to service_role;
