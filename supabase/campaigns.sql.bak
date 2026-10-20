-- Admin-configurable notices and review forms (campaigns). Run once in the Supabase SQL editor (safe to re-run).
-- Row level security is ON with NO policies: only the server (service role) reads or writes these tables.
create table if not exists public.app_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,                                   -- admin-only label
  kind text not null check (kind in ('notice','form')),
  presentation text not null check (presentation in ('modal','banner','toast')),
  heading text not null,
  body text not null default '',
  cta_label text not null default '',
  cta_url text not null default '',
  questions jsonb not null default '[]'::jsonb,
  audience text not null default 'everyone' check (audience in ('everyone','guests','signed_in')),
  frequency text not null default 'once' check (frequency in ('once','every_visit','every_days')),
  repeat_days integer not null default 7 check (repeat_days between 1 and 365),
  allow_later boolean not null default true,
  later_hours integer not null default 8 check (later_hours between 1 and 720),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 3 and 600),
  dismissible boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','paused')),
  version integer not null default 1,                    -- raise it to show the campaign again to people who already answered
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_campaign_responses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.app_campaigns(id) on delete cascade,
  campaign_version integer not null,
  anonymous_id text not null,
  platform text,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, campaign_version, anonymous_id)   -- one answer per device per version; a second replaces the first
);
create index if not exists app_campaign_responses_campaign_idx on public.app_campaign_responses (campaign_id, created_at desc);

alter table public.app_campaigns enable row level security;
alter table public.app_campaign_responses enable row level security;

-- Where a campaign appears: website, Android app, mobile website (default: all three).
alter table public.app_campaigns add column if not exists platforms text[] not null default array['web','android','mobile_web']::text[];

-- Answers follow the signed-in person, so a form answered on the website is not asked again on the phone (and the other way round).
alter table public.app_campaign_responses add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists app_campaign_responses_user_idx on public.app_campaign_responses (user_id, campaign_id);

-- "Remind me later" follows the signed-in person across devices.
create table if not exists public.app_campaign_parked (
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.app_campaigns(id) on delete cascade,
  campaign_version integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, campaign_id)
);
alter table public.app_campaign_parked enable row level security;
