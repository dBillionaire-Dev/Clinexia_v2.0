import { CDS_SERVICE_ID, handlePatientView } from "@/lib/cds/service"
import { cdsAuthorised, cdsEnabled } from "@/lib/cds/gate"

export const dynamic = "force-dynamic"

const MAX_BYTES = 200_000
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })

/**
 * CDS Hooks service call: POST <base>/cds-services/clinexia-renal-function. Stateless: the request body is read, turned into cards and
 * dropped. It is never logged, stored or forwarded, and error responses never repeat it.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!cdsEnabled()) return new Response(null, { status: 404 })
  const { id } = await context.params
  if (id !== CDS_SERVICE_ID) return new Response(null, { status: 404 })
  if (!cdsAuthorised(request.headers.get("authorization"))) return json({ error: "unauthorised" }, 401)

  let text: string
  try { text = await request.text() } catch { return json({ error: "invalid_request" }, 400) }
  if (text.length > MAX_BYTES) return json({ error: "payload_too_large" }, 413)
  let body: unknown
  try { body = JSON.parse(text) } catch { return json({ error: "invalid_json" }, 400) }

  try {
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, "")
    const outcome = handlePatientView(body, { baseUrl })
    return outcome.ok ? json({ cards: outcome.cards }) : json({ error: outcome.message }, outcome.status)
  } catch {
    return json({ error: "internal_error" }, 500)
  }
}
