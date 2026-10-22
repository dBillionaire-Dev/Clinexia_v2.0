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

revoke all on function public.billing_link_device(text, uuid, text) from public, anon, authenticated;
grant execute on function public.billing_link_device(text, uuid, text) to service_role;
notify pgrst, 'reload schema';
