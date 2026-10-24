# Clinexia billing go-live runbook

Do the parts in order. Stay in Paystack **test mode** until Part 6. Billing stays **off** until Part 5.

## Part 1. Preflight
1. Supabase SQL editor, run (each is safe to re-run): `supabase/billing.sql`, `supabase/billing-admin.sql`, `supabase/email-notifications.sql`, `supabase/billing-launch.sql` (run it again if you ran an older version), `supabase/user-messages.sql`.
2. Vercel environment variables (Production):
   - `PAYSTACK_SECRET_KEY` = your **test** key (`sk_test_...`)
   - `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `BILLING_FROM_EMAIL` (`Clinexia <billing@yourdomain>`, domain verified in Resend), `CRON_SECRET`
   - do NOT set `BILLING_ENFORCE_PREMIUM`: locking is now switched on from the admin page (Part 5)
3. Paystack dashboard, Settings > API Keys & Webhooks: set the **Test Webhook URL** to `https://www.clinexia.app/api/billing/webhook`. (Test and live modes have separate webhook URLs.)
4. Redeploy, then open Admin > Setup. Every line should be green.
5. Decide in Supabase (Authentication > Providers > Email) whether email confirmation is required, and use two real inboxes you control for the tests below.

## Part 2. Automatic checks
```
SITE=https://www.clinexia.app CRON_SECRET=... PAYSTACK_SECRET_KEY=sk_test_... bash billing-golive-check.sh
```
Fix every FAIL before continuing.

## Part 3. Individual payment (test card)
1. Register with inbox A, confirm the email if asked, sign in.
2. Start checkout for a plan. On Paystack's test page use their test card (at the time of writing: 4084 0840 8408 4081, any future expiry, CVV 408, PIN 0000, OTP 123456; check Paystack's test-card page if it has changed).
3. You return to `/account/payment` and the plan shows **active**.
4. Inbox A gets a **receipt** (amount, plan, reference, active-until date). Admin > Audit shows the payment.
5. In Paystack, resend the webhook for that transaction (or let it retry). Expect no second receipt and no second month added.
6. Start another checkout and close the Paystack page without paying. The plan must not become active.

## Part 4. Organisation, invitation and reminder
1. Sign in as inbox A, create an organisation, pay for it (test card). The receipt names the organisation.
2. Invite inbox B. B gets the **invitation email**; the screen says "Invitation emailed to ...". Open the link in another browser, sign in or register as B, accept. B now has the organisation's access and A's seat count updates.
3. Invite a deliberately undeliverable address only if you want to see the fallback: the screen then shows that person's private link instead.
4. Reminder test. In the Supabase SQL editor (use inbox A's email):
   ```sql
   update billing_subscriptions
      set current_period_end = now() + interval '2 days', reminder_sent_for = null
    where user_id = (select id from auth.users where email = 'inbox-a@example.com');
   ```
   Run the job once: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.clinexia.app/api/billing/reminders`. Expect `"sent":1` and a "plan ends in 2 days" email. Run it again: `"sent":0` (one reminder per period).
5. Put the test date back (or pay again), so the test account is not left expiring.

## Part 5. Show payments to users (admin button)
1. Admin > Pricing. At the top is **Payments for users**. While payments are hidden, users see no prices, plans or checkout, and nothing is locked.
2. Set **Free period for everyone already here** (30 = one free month) and **Free days for each new user from signup** (7 = one week), then press **Show payments to users** and confirm.
3. Existing users and visitors keep full access until the free period ends, then premium calculators lock for people without a plan. Anyone who joins after you pressed the button also gets their own free days from signup, then the lock applies to them.
4. To test locking without waiting, set both values to 0 and press **Save free periods**: a free account then sees premium calculators locked; the paid account and organisation member B can open them.
5. Rollback: **Hide payments** (everything becomes free and the payment screens disappear; paid plans are kept). Changes apply within about 15 seconds.

## Part 5b. Private message to one user
1. Admin > Users > open a user > **Send a private message**. Write a title and message, press Send.
2. Check: the message shows on that person's account page and in the Android app (top card, or a pop-up if they tap the phone notification), the phone notification arrives if they are signed in on a phone with notifications set up, and the email arrives.
3. The result line under the button says what happened for each of the three.

## Part 6. Go live
1. Admin > Pricing: set real naira prices and the **real dollar prices** (the defaults are placeholders). USD checkout also needs international payments enabled on your Paystack account.
2. Vercel: replace `PAYSTACK_SECRET_KEY` with the **live** key and redeploy.
3. Paystack: set the **Live Webhook URL** to the same address.
4. Re-run `billing-golive-check.sh` with the live key.
5. Make one small real payment with your own card, confirm access and the receipt, then refund it from the Paystack dashboard.
6. Android: publish the web changes first, then build the APK (`apply-resend-emails-mobile.sh`, bump the version). If you list the app on Google Play, check Play's payment rules for subscriptions before enabling Paystack checkout in that build.

## If something fails
| Symptom | Likely cause |
|---|---|
| Check 3 says signature refused | Vercel key differs from yours, or you did not redeploy after changing it |
| Plan paid but not active | Webhook URL not set for that mode (test vs live), or `SUPABASE_SERVICE_ROLE_KEY` missing |
| No receipt, plan active | Resend domain not verified, or `email-notifications.sql` not run. Vercel logs show Resend's reason; the daily job retries failed receipts for 2 days |
| Reminder job returns 503 / 401 | `CRON_SECRET` not set / different from the one used in the call |
| Reminder job 500 mentioning the SQL file | `email-notifications.sql` not run |
