-- Links anonymous devices to the real account of the person who registers or signs in on them, so the admin sees their name and
-- their whole calculation history (including everything done before they registered). Run once, after analytics.sql and billing.sql.
-- Server-only table (RLS on, no policies).
create table if not exists public.billing_device_links (
  anonymous_id text not null,                           -- the random ID the app keeps on a device (convertlab_devices.anonymous_id)
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (anonymous_id, user_id)                   -- a shared device can belong to more than one account
);
create index if not exists billing_device_links_user_idx on public.billing_device_links (user_id);
alter table public.billing_device_links enable row level security;

-- Records the link and gives the device the person's name. A name an admin typed by hand is never overwritten:
-- only the automatic "User-XXXXXX" name is replaced.
create or replace function public.billing_link_device(p_anonymous_id text, p_user uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_auto text := public.convertlab_display_name(p_anonymous_id);
  v_name text := left(nullif(trim(p_name), ''), 80);
  v_renamed integer := 0;
begin
  insert into billing_device_links (anonymous_id, user_id) values (p_anonymous_id, p_user) on conflict do nothing;
  if v_name is not null then
    insert into convertlab_devices (anonymous_id, display_name, first_seen_at, last_seen_at)
    values (p_anonymous_id, v_name, now(), now()) on conflict (anonymous_id) do nothing;
    update convertlab_devices set display_name = v_name where anonymous_id = p_anonymous_id and display_name = v_auto and display_name <> v_name;
    get diagnostics v_renamed = row_count;
  end if;
  return jsonb_build_object('linked', true, 'renamed', v_renamed > 0);
end $$;

-- Links devices that are already known to belong to an account (phones that registered for notifications while signed in, and forms
-- answered while signed in), and gives every linked device the account's name. Safe to run any number of times.
create or replace function public.billing_backfill_device_links()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_links integer; v_renamed integer;
begin
  with pairs as (
    select anonymous_id, user_id from push_devices where user_id is not null and anonymous_id is not null
    union
    select anonymous_id, user_id from app_campaign_responses where user_id is not null and anonymous_id is not null
  ), added as (
    insert into billing_device_links (anonymous_id, user_id)
    select anonymous_id, user_id from pairs where anonymous_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    on conflict do nothing returning 1
  ) select count(*) into v_links from added;

  update convertlab_devices d
     set display_name = left(coalesce(nullif(trim(p.full_name), ''), split_part(u.email, '@', 1)), 80)
    from (select distinct on (anonymous_id) anonymous_id, user_id from billing_device_links order by anonymous_id, linked_at asc) first_link
    join auth.users u on u.id = first_link.user_id
    left join billing_profiles p on p.user_id = u.id
   where d.anonymous_id = first_link.anonymous_id and d.display_name = public.convertlab_display_name(d.anonymous_id);
  get diagnostics v_renamed = row_count;
  return jsonb_build_object('links_added', v_links, 'renamed', v_renamed);
end $$;

-- When an account is deleted, its name must not stay on the device records.
create or replace function public.billing_forget_user_devices(p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_name text; v_count integer := 0;
begin
  select left(coalesce(nullif(trim(p.full_name), ''), split_part(u.email, '@', 1)), 80) into v_name
    from auth.users u left join billing_profiles p on p.user_id = u.id where u.id = p_user;
  if v_name is not null then
    update convertlab_devices d set display_name = public.convertlab_display_name(d.anonymous_id)
     where d.anonymous_id in (select anonymous_id from billing_device_links where user_id = p_user) and d.display_name = v_name;
    get diagnostics v_count = row_count;
  end if;
  return v_count;
end $$;

revoke all on function public.billing_link_device(text, uuid, text) from public, anon, authenticated;
revoke all on function public.billing_backfill_device_links() from public, anon, authenticated;
revoke all on function public.billing_forget_user_devices(uuid) from public, anon, authenticated;
grant execute on function public.billing_link_device(text, uuid, text) to service_role;
grant execute on function public.billing_backfill_device_links() to service_role;
grant execute on function public.billing_forget_user_devices(uuid) to service_role;
notify pgrst, 'reload schema';
