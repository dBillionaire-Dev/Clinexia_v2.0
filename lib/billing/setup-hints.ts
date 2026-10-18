// Turns a raw server-side failure into a plain "what to fix" sentence. Shown to the developer (in dev responses and logs),
// never to the public in production.
export function explainSetupError(message: string): string | null {
  const m = message.toLowerCase()
  if (m.includes("supabase_anon_key")) return "SUPABASE_ANON_KEY is missing. Add it to .env.local (Supabase > Project Settings > API > anon public key) and restart pnpm dev."
  if (m.includes("supabase_url") || m.includes("service_role")) return "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Add them to .env.local and restart pnpm dev."
  if (m.includes("billing_user_status")) return "The billing_user_status table does not exist. Run supabase/billing-admin.sql in the Supabase SQL editor."
  if (/pgrst205|42p01|does not exist|could not find the table/.test(m) && m.includes("billing_")) return "A billing table is missing. Run supabase/billing.sql and then supabase/billing-admin.sql in the Supabase SQL editor."
  if (m.includes("invalid api key") || m.includes("(401)") || m.includes("(403)")) return "Supabase rejected the key. Check that SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are the right ones for this project."
  if (m.includes("fetch failed") || m.includes("econnrefused") || m.includes("enotfound")) return "Could not reach Supabase. Check SUPABASE_URL and your internet connection."
  return null
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
