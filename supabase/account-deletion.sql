-- Delete account (a soft delete). Run once in the Supabase SQL editor; safe to re-run.
-- The person's data stays in the database. deleted_at starts a 7-day window in which signing in offers to restore the account;
-- after that deletion_final_at is set, the sign-in email is freed so the person can register again, and the original email is kept here.
alter table public.billing_user_status add column if not exists deleted_at timestamptz;
alter table public.billing_user_status add column if not exists deletion_final_at timestamptz;
alter table public.billing_user_status add column if not exists deleted_email text;
create index if not exists billing_user_status_deleted_idx on public.billing_user_status (deleted_at) where deleted_at is not null and deletion_final_at is null;
