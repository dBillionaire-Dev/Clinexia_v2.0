import { discoveryDocument } from "@/lib/cds/service"
import { cdsEnabled } from "@/lib/cds/gate"

export const dynamic = "force-dynamic"

/** CDS Hooks discovery: GET <base>/cds-services. The CDS Hooks base URL for this app is https://<host>/api. Off unless CDS_HOOKS_ENABLED=true. */
export function GET() {
  if (!cdsEnabled()) return new Response(null, { status: 404 })
  return new Response(JSON.stringify(discoveryDocument()), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } })
}
