-- Apply after 0006_room_history.sql. One portfolio value per user per day, for the value chart.
create table if not exists public.portfolio_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_on date not null,
  value_cad numeric(14,2) not null,
  primary key (user_id, snapshot_on)
);
alter table public.portfolio_snapshots enable row level security;
create policy "own portfolio_snapshots" on public.portfolio_snapshots for all using (auth.uid() = user_id);
