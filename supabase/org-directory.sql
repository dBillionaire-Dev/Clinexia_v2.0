-- Organisation directory: groups (departments), disabling members, and accounts created by the organisation itself.
-- Run once in the Supabase SQL editor; safe to re-run.
create table if not exists public.billing_org_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.billing_organisations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index if not exists billing_org_groups_name_idx on public.billing_org_groups (org_id, lower(name));

alter table public.billing_memberships add column if not exists group_id uuid references public.billing_org_groups(id) on delete set null;
alter table public.billing_memberships add column if not exists disabled boolean not null default false;   -- no access through the organisation while true; keeps the seat
alter table public.billing_memberships add column if not exists managed boolean not null default false;    -- the account was created by the organisation (it may reset that person's password)

-- Adds a member whose account the organisation just created. Same seat rule as invitations: members + pending invitations stay within seats.
create or replace function public.billing_provision_member(
  p_org uuid, p_user uuid, p_role text, p_all boolean, p_specs text[], p_group uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_seats integer; v_members integer; v_pending integer;
begin
  select seats into v_seats from billing_organisations where id = p_org for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_capacity'); end if;
  if exists (select 1 from billing_memberships where org_id = p_org and user_id = p_user) then
    return jsonb_build_object('ok', false, 'reason', 'already_member');
  end if;
  select count(*) into v_members from billing_memberships where org_id = p_org;
  select count(*) into v_pending from billing_invitations where org_id = p_org and status = 'pending' and expires_at > now();
  if v_members + v_pending >= v_seats then return jsonb_build_object('ok', false, 'reason', 'no_capacity'); end if;
  insert into billing_memberships (org_id, user_id, role, all_specialties, specialties, group_id, managed)
  values (p_org, p_user, p_role, p_all, coalesce(p_specs, '{}'), p_group, true);
  return jsonb_build_object('ok', true);
end $$;

alter table public.billing_org_groups enable row level security;
revoke all on function public.billing_provision_member(uuid, uuid, text, boolean, text[], uuid) from public, anon, authenticated;
