// Turns a raw server-side failure into a plain "what to fix" sentence. Shown to the developer (in dev responses and logs),
// never to the public in production.
export function explainSetupError(message: string): string | null {
  const m = message.toLowerCase()
  const sql = missingSqlHint(message)
  if (sql && !m.includes("supabase_anon_key")) return sql
  if (m.includes("supabase_anon_key")) return "SUPABASE_ANON_KEY is missing. Add it to .env.local (Supabase > Project Settings > API > anon public key) and restart pnpm dev."
  if (m.includes("supabase_url") || m.includes("service_role")) return "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Add them to .env.local and restart pnpm dev."
  if (m.includes("billing_user_status")) return "The billing_user_status table does not exist. Run supabase/billing-admin.sql in the Supabase SQL editor."
  if (/pgrst205|42p01|does not exist|could not find the table/.test(m) && m.includes("billing_")) return "A billing table is missing. Run supabase/billing.sql and then supabase/billing-admin.sql in the Supabase SQL editor."
  if (m.includes("invalid api key") || m.includes("(401)") || m.includes("(403)")) return "Supabase rejected the key. Check that SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are the right ones for this project."
  if (m.includes("fetch failed") || m.includes("econnrefused") || m.includes("enotfound")) return "Could not reach Supabase. Check SUPABASE_URL and your internet connection."
  return null
}

const MISSING = /pgrst20[245]|42p01|42703|does not exist|could not find (the )?(table|column|function)/i
// Which SQL file creates what (most specific first).
const FILE_FOR: Array<[RegExp, string]> = [
  [/billing_device_links|billing_link_device|billing_backfill|billing_forget/i, "supabase/billing-link.sql"],
  [/bucket not found|storage.*avatars|avatars.*bucket/i, "supabase/avatars.sql"],
  [/push_messages_audience_check|push_messages\.user_id|user_id.*push_messages/i, "supabase/user-messages.sql"],
  [/billing_launch|introduced_at|new_user_trial_days/i, "supabase/billing-launch.sql"],
  [/emailed_at|receipt_sent_at|reminder_sent_for/i, "supabase/email-notifications.sql"],
  [/billing_user_status|\bmarket\b|\bsource\b/i, "supabase/billing-admin.sql"],
  [/app_campaign|platforms/i, "supabase/campaigns.sql"],
  [/push_devices|push_messages/i, "supabase/push.sql"],
  [/billing_/i, "supabase/billing.sql"],
]
/** "Run supabase/x.sql" when a failure is a missing table, column or function; otherwise null. */
export function missingSqlHint(message: string): string | null {
  if (!MISSING.test(message)) return null
  for (const [re, file] of FILE_FOR) if (re.test(message)) return `A table or column is missing. Run ${file} in the Supabase SQL editor (Admin > Setup check lists everything).`
  return "A table, column or function is missing. Open Admin > Setup check to see which SQL file to run."
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
