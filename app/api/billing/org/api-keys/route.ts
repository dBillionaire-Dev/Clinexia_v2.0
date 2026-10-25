import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api/keys-admin"
import { supabaseKeyStore } from "@/lib/api/key-store"
import { failure, guard, isResponse, json, problem, readJson, requireUser } from "@/lib/billing/route-kit"
import { orgStore } from "@/lib/billing/store"

export const dynamic = "force-dynamic"

const deps = { orgs: orgStore, keys: supabaseKeyStore }

/** GET ?orgId=...  -> the organisation's keys (never the key itself). Owners and admins only. */
export async function GET(request: Request) {
  const blocked = guard(request)
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  const orgId = new URL(request.url).searchParams.get("orgId") ?? ""
  const r = await listApiKeys(deps, { userId: user.id }, orgId).catch(() => null)
  if (!r) return problem("Could not load API keys. Has supabase/api-keys.sql been run?", 503)
  return r.ok ? json({ keys: r.keys }) : failure(r)
}

/** POST { action: "create", orgId, name, allowDosing? } -> { key (shown once), record }   |   { action: "revoke", orgId, keyId } */
export async function POST(request: Request) {
  const blocked = guard(request, { write: true })
  if (blocked) return blocked
  const user = await requireUser()
  if (isResponse(user)) return user
  let body: any
  try {
    body = await readJson(request)
  } catch {
    return problem("Invalid request.", 400)
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  const actor = { userId: user.id }
  try {
    if (body?.action === "create") {
      const r = await createApiKey(deps, actor, str(body.orgId), { name: body.name, allowDosing: body.allowDosing === true })
      return r.ok ? json({ key: r.key, record: r.record }, 201) : failure(r)
    }
    if (body?.action === "revoke") {
      const r = await revokeApiKey(deps, actor, str(body.orgId), str(body.keyId))
      return r.ok ? json({ ok: true }) : failure(r)
    }
  } catch {
    return problem("Could not complete this. Has supabase/api-keys.sql been run?", 503)
  }
  return problem("Unknown action.", 400)
}
