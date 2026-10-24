-- Admin "Introduce payments" button and the free periods. Run once in the Supabase SQL editor; safe to re-run
-- (also safe if you already ran the earlier version: it only adds what is missing).
-- enforce = payments are introduced (shown to users; premium locks apply once the free period ends).
-- free_until = everyone has full access until then. introduced_at = when payments were introduced (new users are those who join after).
-- new_user_trial_days = free days from signup for each person who joins after payments were introduced.
create table if not exists public.billing_launch (
  id integer primary key default 1 check (id = 1),
  enforce boolean not null default false,
  free_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.billing_launch add column if not exists introduced_at timestamptz;
alter table public.billing_launch add column if not exists new_user_trial_days integer not null default 7;
insert into public.billing_launch (id) values (1) on conflict (id) do nothing;
-- If payments were already switched on with the earlier version, treat them as introduced now.
update public.billing_launch set introduced_at = coalesce(introduced_at, updated_at) where enforce and introduced_at is null;
alter table public.billing_launch enable row level security;
