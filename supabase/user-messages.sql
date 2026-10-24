-- Private messages from the admin to one user (shown in the app and sent to their phone and email). Run once; safe to re-run.
alter table public.push_messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.push_messages drop constraint if exists push_messages_audience_check;
alter table public.push_messages add constraint push_messages_audience_check check (audience in ('everyone','signed_in','guests','user'));
create index if not exists push_messages_user_idx on public.push_messages (user_id, created_at desc) where user_id is not null;
