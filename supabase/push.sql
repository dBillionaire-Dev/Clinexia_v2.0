-- Phone notifications (push). Run once in the Supabase SQL editor (safe to re-run). Server-only tables (RLS on, no policies).
create table if not exists public.push_devices (
  token text primary key,                                -- the phone's Firebase Cloud Messaging token
  anonymous_id text,
  user_id uuid references auth.users(id) on delete set null,   -- set while someone is signed in on that phone
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists push_devices_user_idx on public.push_devices (user_id);

create table if not exists public.push_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  url text not null default '',
  audience text not null check (audience in ('everyone','signed_in','guests')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  removed_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.push_devices enable row level security;
alter table public.push_messages enable row level security;
