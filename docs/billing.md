# Accounts, subscriptions and account administration

## What is where
- Sign-in and sign-up for testing: `/login` and `/register` (not linked from the home page, not in the sitemap). After signing in, people land on `/account`.
- Organisation dashboard: `/account/organisation?org=<id>`. Staff invitation links: `/account/join?token=...`. Payment return: `/account/payment`.
- Administrator screen: `/admin/accounts` (uses the existing admin login). Tabs: Users, Organisations, Pricing, Audit.
- The home page and every existing calculator are untouched. Premium locking is OFF until `BILLING_ENFORCE_PREMIUM=true`.
- To switch the whole feature off: set `BILLING_ENABLED=false` (every page and API then answers 404).

## Set up
1. Supabase SQL editor: run `supabase/billing.sql`, then `supabase/billing-admin.sql` (both safe to re-run).
2. Supabase: Authentication > Providers > Email on (decide whether email confirmation is required).
3. Env vars (Vercel): `SUPABASE_ANON_KEY` (new), `PAYSTACK_SECRET_KEY` (new, use the TEST key while testing).
   Optional, for emailed notices: `RESEND_API_KEY` and `BILLING_FROM_EMAIL` (new). Without them the admin screen says no email was sent.
   Already present: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET`.
4. Paystack dashboard: webhook URL `https://<your app domain>/api/billing/webhook`.

## Pricing (admin > Pricing)
- Two independent price lists: Nigeria (NGN, kobo) and International (USD, cents). Individual and organisation prices, the
  organisation all-access cap and seat block, the managed-organisation discount, and grace days are all editable.
- Which list applies: set at sign-up from the visitor's country (Nigeria = naira, anywhere else = dollars), stored on the profile
  and, for organisations, on the organisation (it inherits its owner's). Only an administrator can change it afterwards.
- USD checkout only works if your Paystack account has international payments enabled. The dollar defaults are placeholders.
- A payment already started keeps the price it showed. New prices apply to the next checkout.

## Suspending and deleting (admin > Users / Organisations)
- A reason is required. Suspended people cannot sign in and are shown the notice when they try. Restoring lifts it.
- Deleting a person removes their sign-in account, profile, memberships and subscription. You must type their email to confirm.
  Payment records are kept with their links cleared. Someone who owns an organisation cannot be deleted until it is deleted or reassigned.
- Deleting an organisation removes its members' membership, invitations and subscription; you must type its name to confirm.
- Notices are emailed only when `RESEND_API_KEY` and `BILLING_FROM_EMAIL` are set. Deletion notices are sent before deleting.
- Every action is written to the audit trail.

## Rules
- Enterprise all-access: capped (default N45,000) for the first block of seats (default 10), then a flat price per extra seat (default N2,500).
- Pending invitations reserve a seat. Each payment buys one month; there is no auto-renewal. Same-plan renewal extends the period;
  a different plan starts fresh from today with no credit for unused time (no proration).
- The managed-organisation discount (default 10%, customer pays 90%) applies only when an administrator marks the organisation `verified`.

## Premium lock (local testing)
- Set `BILLING_ENFORCE_PREMIUM=true` in `.env.local` (repo root) and restart `pnpm dev`. On Vercel: Project > Settings > Environment Variables, then redeploy.
- With it on, specialty calculators show an upgrade screen unless the person's plan or organisation seat covers that specialty. The
  "general" category stays free. Edit `FREE_CATEGORIES` / `FREE_CALCULATOR_IDS` / `PREMIUM_CALCULATOR_IDS` in `lib/billing/config.ts` to change that.
- Check: `GET /api/billing/access?id=<calculator id>` returns what the page is told. Offline or unreachable = the calculator stays usable.
- This is a front-end lock; the calculations still run in the browser. Real protection needs premium calculations moved behind a server endpoint.

## Sign-up, sign-in and the navbar icon
- Register at `/register`. If email confirmation is on (Supabase > Authentication > Providers > Email), people see "Check your email" and,
  after 10 seconds, land on `/login`. They can resend the email. When they sign in they go to the app home page (or to the page they
  were heading to via `?next=`), not to `/account`. `/account` opens when they use a premium tool ("See plans") or from the navbar menu.
- Supabase > Authentication > URL Configuration: set **Site URL** to your app address and add `<your address>/login` (and
  `http://localhost:3000/login` for testing) to **Redirect URLs**, or the confirmation link will not bring people back.
- The navbar profile icon appears whenever accounts are on. Signed out: Sign in / Create account. Signed in: My account / Sign out.

## Guests (only while BILLING_ENFORCE_PREMIUM=true)
- A signed-out visitor gets 3 calculations per device (each browser, installed PWA or Android app keeps its own count). After that the
  page is browse-only: links work, everything else asks them to create an account. Clearing site data resets the count (front-end limit).
- Tool lists and tool pages show **Free** or **Premium · <specialty>** badges (All-access covers every premium specialty); signed-in
  people see **Unlocked** on specialties they have.

## Dialogs
- Use `confirmDialog` / `promptDialog` from `components/ui/app-dialogs.tsx` instead of `window.confirm` / `window.prompt`. They need no provider and follow the app theme.

## Campaigns (admin > Campaigns): notices and review forms without coding
- Run `supabase/campaigns.sql` once. Then open `/admin/campaigns` (nav: Campaigns).
- Per campaign choose: notice or review form (questions: stars, written, pick one, pick several, yes/no), how it appears (pop-up window,
  bar under the header, small corner alert), heading, message, optional button and link, who sees it (everyone, guests, signed in),
  how often (once, every visit, every N days), start and end time (it starts and stops by itself), "Remind me later" and its wait,
  auto-hide seconds (bars and alerts), whether it can be closed. Preview shows it before it goes live.
- People who answer a form never see it again; people who tap "Remind me later" see it again after the wait. "Show again to everyone"
  re-opens a campaign to people who already answered. One campaign appears per visit, a few seconds after the app opens.
- Responses: open a form campaign to read every answer.

## Feedback reminders
- The in-app star prompt now re-reads what is saved before every decision and never overwrites a recorded answer. The server also
  remembers which device answered each round (`/api/feedback/answered`), so people who answered are not asked again, even after their
  saved state is lost. People who tap Later come back after the configured hours; "Ask everyone again" (new round) re-opens it for all.

## If sign-in shows 503
- In development the error now says what to fix. Usual causes: `SUPABASE_ANON_KEY` missing from `.env.local`, or
  `supabase/billing.sql` / `supabase/billing-admin.sql` not run. Restart `pnpm dev` after editing `.env.local`.

## "Remind me later" and the profile icon
- Tapping "Remind me later" on a campaign shrinks the card into the profile icon, which gets a red "!" (and a small bounce when the
  card lands). Open the profile menu: a "Complete feedback form" entry reopens the form in a pop-up. Answering removes it; "No thanks,
  remove this reminder" in that pop-up removes it too. Notices parked this way show as "You have a message" and clear once opened.
- Parked items disappear by themselves if the campaign ends, is paused or deleted, or is re-issued with "Show again to everyone".
- The normal timed reminder (the hours set on the campaign) still applies. If accounts are switched off there is no profile icon, so
  "Remind me later" simply waits the set hours. People who prefer reduced motion get no flying animation (the "!" still appears).
