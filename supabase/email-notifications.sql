-- Automatic emails (invitations, payment receipts, "plan ending soon" reminders). Run once in the Supabase SQL editor; safe to re-run.
-- Adds the columns that remember what has already been emailed, so nobody gets the same email twice.

alter table public.billing_invitations  add column if not exists emailed_at timestamptz;        -- when the invitation email was sent
alter table public.billing_orders       add column if not exists receipt_sent_at timestamptz;   -- when the receipt email was sent (null = not yet)
alter table public.billing_subscriptions add column if not exists reminder_sent_for timestamptz; -- the period end a reminder was already sent for

-- Payments made before this feature existed must not get a receipt now.
update public.billing_orders set receipt_sent_at = coalesce(paid_at, now()) where status = 'paid' and receipt_sent_at is null;

create index if not exists billing_subscriptions_period_end_idx on public.billing_subscriptions (current_period_end)
  where status in ('active', 'past_due', 'cancelled');
