-- Clinexia accounts, part 2: markets (Nigeria / international pricing), account suspension, and safe deletion.
-- Run AFTER supabase/billing.sql, once, in the Supabase SQL editor (safe to re-run).

-- Which price list a person or organisation uses: 'ng' = naira, 'intl' = dollars. Set at sign-up from the visitor's country;
-- only an administrator can change it afterwards.
alter table public.billing_profiles add column if not exists market text not null default 'ng' check (market in ('ng','intl'));
alter table public.billing_organisations add column if not exists market text not null default 'ng' check (market in ('ng','intl'));

-- Where the account was created: the website, the Android app, or the mobile website (shown in admin).
alter table public.billing_profiles add column if not exists source text not null default 'web' check (source in ('web','android','mobile_web'));

-- Suspension. A suspended person cannot sign in to Clinexia; the notice is what they are shown.
create table if not exists public.billing_user_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended')),
  reason text,
  notice text,
  suspended_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.billing_user_status enable row level security;   -- no policies: server (service role) only

-- Deleting an account must not be blocked by, or destroy, financial records. Payment records are kept; their links to the
-- deleted person/organisation/subscription are cleared instead.
alter table public.billing_orders alter column subscription_id drop not null;
alter table public.billing_orders alter column payer_user_id drop not null;
alter table public.billing_invitations alter column invited_by drop not null;

alter table public.billing_orders drop constraint if exists billing_orders_subscription_id_fkey;
alter table public.billing_orders add constraint billing_orders_subscription_id_fkey foreign key (subscription_id) references public.billing_subscriptions(id) on delete set null;
alter table public.billing_orders drop constraint if exists billing_orders_user_id_fkey;
alter table public.billing_orders add constraint billing_orders_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
alter table public.billing_orders drop constraint if exists billing_orders_payer_user_id_fkey;
alter table public.billing_orders add constraint billing_orders_payer_user_id_fkey foreign key (payer_user_id) references auth.users(id) on delete set null;
alter table public.billing_orders drop constraint if exists billing_orders_org_id_fkey;
alter table public.billing_orders add constraint billing_orders_org_id_fkey foreign key (org_id) references public.billing_organisations(id) on delete set null;
alter table public.billing_invitations drop constraint if exists billing_invitations_invited_by_fkey;
alter table public.billing_invitations add constraint billing_invitations_invited_by_fkey foreign key (invited_by) references auth.users(id) on delete set null;
