-- Origins that may frame /embed (CSP frame-ancestors) and exchange postMessages with it.
-- Run once in the Supabase SQL editor; safe to re-run. Read server-side only (service role), same as the billing tables.
-- Add a partner:  insert into public.embed_partners (origin) values ('https://emr.hospital.org');
-- Origins are bare scheme://host[:port] with no path, no wildcard. Anything else is ignored by the app.
create table if not exists public.embed_partners (
  origin text primary key check (origin ~ '^https://[^/\s;,]+$' or origin ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$'),
  org_id uuid references public.billing_organisations (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.embed_partners enable row level security;
revoke all on table public.embed_partners from anon, authenticated;
