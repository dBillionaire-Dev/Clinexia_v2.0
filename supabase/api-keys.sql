-- Clinexia public API (v1): API keys and metering. Run once in the Supabase SQL editor; safe to re-run.
-- Access is by the service role only (same as the billing tables): RLS is on and there are no policies.
-- The key itself is NEVER stored: only its SHA-256 hash and a short display prefix. api_usage_daily holds counts only:
-- no inputs, no results, nothing about patients.

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.billing_organisations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null,                            -- first characters of the key, for display only
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),  -- sha-256 (hex) of the full key
  scopes text[] not null default '{}',                 -- read:catalog, calculate:general, calculate:dosing, convert
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_org_idx on public.api_keys (org_id);

create table if not exists public.api_usage_daily (
  key_id uuid not null references public.api_keys (id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  errors integer not null default 0,
  primary key (key_id, day)
);

alter table public.api_keys enable row level security;
alter table public.api_usage_daily enable row level security;
revoke all on table public.api_keys from anon, authenticated;
revoke all on table public.api_usage_daily from anon, authenticated;

-- One call = one atomic increment (counts only) plus the key's last_used_at.
create or replace function public.api_record_usage(p_key_id uuid, p_error boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.api_usage_daily (key_id, day, calls, errors)
  values (p_key_id, (now() at time zone 'utc')::date, 1, case when p_error then 1 else 0 end)
  on conflict (key_id, day) do update
    set calls = public.api_usage_daily.calls + 1,
        errors = public.api_usage_daily.errors + case when p_error then 1 else 0 end;
  update public.api_keys set last_used_at = now() where id = p_key_id;
end;
$$;
revoke all on function public.api_record_usage(uuid, boolean) from public, anon, authenticated;
