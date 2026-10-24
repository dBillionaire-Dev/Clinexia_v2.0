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
- Payments are shown or hidden from Admin > Pricing > "Payments for users" (run `supabase/billing-launch.sql` once). Hidden = no prices, plans or checkout, nothing locked. "Show payments" introduces them to new and existing users: everyone keeps full access for the chosen free period (default 30 days), then locks start by themselves; anyone who joins after payments were introduced also gets their own free days from signup (default 7). "Hide payments" makes everything free again; paid plans are kept.
- Admin > Users > open a user > "Send a private message" (run `supabase/user-messages.sql` once): the message appears in that person's app (and on their account page), is sent to their phones when notifications are set up, and is emailed through Resend. Nobody else can see it.
- Account page: people change their name, role and password (the current password is required; every session then ends and they sign in again), and upload a profile photo (JPEG or PNG up to 2 MB; the browser crops it to a small square JPEG). The photo is stored in the public Supabase bucket `avatars` (run `supabase/avatars.sql` once) and shows in the navbar icon instead of the initial. An account that has a Google photo on file (Supabase keeps it as `avatar_url`/`picture` when someone signs in with Google) shows that photo until they upload their own. The email address cannot be changed there.
- Organisation directory (run `supabase/org-directory.sql` once): owners and administrators of an organisation can create groups (departments), put members in a group, disable or re-enable a member (they lose the organisation's access but keep their seat), add people by creating their accounts directly (one person, or a pasted spreadsheet of up to 50 with columns name, email, optional role and group; each person is emailed a link to choose a password and uses one seat), and email a password link to people whose accounts the organisation created. People who already have a Clinexia account are never added silently: they are invited and must accept. The organisation cannot reset the password of anyone who created their own account.
- Traction page: the figures refresh themselves when the page is opened (last three days, if the last refresh is over ten minutes old; everything the first time), so new installs and usage appear without waiting for the nightly job. "Refresh now" forces it. Subscription revenue is counted automatically from paid orders, in naira and dollars separately; other income entered by hand can be edited or deleted.
- Forgot password: "Forgot password?" on the sign-in screen (website and app) emails a reset link through Resend (needs `RESEND_API_KEY`, `BILLING_FROM_EMAIL` and `SUPABASE_SERVICE_ROLE_KEY`). The link opens `/account/reset` on the website, works once, and changing the password signs the account out everywhere and emails a "password changed" notice. The sign-in screen tells the person plainly when an email is not registered (limited per connection and per address). Administrators can also reset a person's password from Admin > Users > the person: email them a link, or create a one-use link to hand over; both are recorded in the audit trail. No Supabase redirect setting is needed.
- Invitations, payment receipts and plan-ending reminders are emailed automatically through Resend (run `supabase/email-notifications.sql` once; reminders need `CRON_SECRET`, the job runs daily from `vercel.json`). Each email is sent once. If an invitation email fails, the inviter still gets the private link on screen.
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

## Mobile app (Clinexia_V3_0-Mobile) uses this backend
- The Android app and the mobile site have no server of their own: sign-up, sign-in, plans, checkout, campaigns and feedback all go
  through this site's APIs, so accounts, plans and responses are shared and appear in the admin screens (Users shows where each
  account was created: Website, Android app or Mobile site).
- The apps sign in with tokens: `POST /api/account/login` with the header `X-Clinexia-Client: android` (or `mobile-web`) returns the tokens in
  the response instead of setting cookies; they are sent back as `Authorization: Bearer <token>`; `POST /api/account/refresh` renews them.
- `proxy.ts` answers the browsers' preflight requests only for the origins in `lib/billing/cors.ts` (Android app `https://localhost`, the
  mobile site `https://clinexia-mobile.vercel.app`). Add others with `MOBILE_ALLOWED_ORIGINS=https://a.example,https://b.example`.
- Mobile checkouts open Paystack in the system browser; Paystack returns to `/account/payment?app=1`, which just says to go back to the app,
  and the app confirms the payment itself.
- Re-run `supabase/billing-admin.sql` (adds `billing_profiles.source`).

## Where a campaign shows, and following the account
- In Admin > Campaigns each campaign has "Where it shows": Website, Android app, Mobile website (tick any). Run `supabase/campaigns.sql` again to add the setting.
- Forms answered while signed in are linked to the account, so answering on the website means the phone does not ask again (and the other way round).
  "Remind me later" also follows the account: park a form on the phone and it waits in the profile icon on the website too.
  Guests have no account to follow, so for them everything stays per device (the 3-calculation guest limit is per phone or browser by nature).
- The app asks the server again when someone returns after about 10 minutes, so a newly published campaign appears without a restart.
- The star-rating prompt (not the campaign forms) is still remembered per device.

## Phone notifications (push) to the Android app
1. Run `supabase/push.sql` once.
2. Firebase console: create a project, add an Android app with the mobile app's package id (the `appId` in the mobile repo's capacitor.config), download
   `google-services.json` into the mobile repo at `android/app/`.
3. Firebase > Project settings > Service accounts > Generate new private key. Put the whole JSON file contents (or its base64) in the server env var
   `FCM_SERVICE_ACCOUNT_JSON` on Vercel, then redeploy.
4. Mobile repo: `pnpm add @capacitor/push-notifications && npx cap sync android`, then build a new APK.
5. Admin > Campaigns > Phone notifications: write a title and message, optionally a link, choose who, press send. It arrives even when the app is closed.
   Phones register when the person turns notifications on (Account > Notifications). Sending is immediate; scheduling a notification is not built.

## Signing in from the app
- The app must use the website's full address, `https://www.clinexia.app` (not `clinexia.app`, which redirects and cannot be used for a POST from the app).
- Testing the mobile app from your computer against the live website: add the origin you are testing from to the website's `MOBILE_ALLOWED_ORIGINS`
  (for example `http://localhost:3000`), redeploy, and remove it afterwards.

## Linking devices to accounts (real name + history in the admin)
- Run `supabase/billing-link.sql` once (after `analytics.sql` and `billing.sql`).
- Every visitor is tracked by a random device ID. When a person registers or signs in on a device (website or app), that device is linked to their account, and the device's
  automatic name ("User-XXXXXX") becomes the name they typed when registering (a name you typed by hand in the admin is never overwritten). Accounts made before this existed link
  the next time that person opens the website or app while signed in.
- Admin > Accounts management > Users > Details now lists the account's linked devices and its full calculation history (most used tools, time span, latest 100), including
  everything done on those devices **before** they registered. You can also link or unlink a device by pasting its device ID.
- A device used by more than one account stays linked to each. Only the first account renames it.
- Privacy: this connects device activity to a named person, only after they register or sign in. Mention it in your privacy policy. The app skips linking when the person has analytics switched off.

## Setup check, device names and notifications (latest)
- **Admin > Setup check** (`/admin/setup`) tests THIS deployment: every table, column, function and environment variable the accounts, campaigns and notifications need, and lists
  exactly which SQL file to run or which variable to add. If Campaigns or Users do not load in production, open it first: production is a separate Supabase project from
  your local one, so each SQL file must be run there too, and Vercel needs its own environment variables (followed by a redeploy).
- **Device names**: run `supabase/billing-link.sql` again to add two functions. Accounts > "Link devices from existing activity" links phones that registered for notifications or
  answered a form while signed in, and gives every linked device its account's name (an admin-typed name is never overwritten). Deleting an account takes its name off the devices.
- **Notifications stay until closed**: in the Android app a tapped notification opens the app and shows as a pop-up, every notification stays until closed, and missed ones appear when the
  app opens (`GET /api/push/recent`, last 7 days, filtered by signed-in or guest). New notifications are saved before they are sent so the app can recognise them.
