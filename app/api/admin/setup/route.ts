import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { runSetupCheck, summariseChecks } from "@/lib/billing/setup-check"

export const dynamic = "force-dynamic"

// Administrator only: which parts of the accounts, campaigns and notifications setup are missing in THIS deployment.
export async function GET() {
  if (!(await isAdminAuthenticated())) return new NextResponse("Unauthorized", { status: 401 })
  const checks = await runSetupCheck()
  return NextResponse.json({ checks, summary: summariseChecks(checks) }, { headers: { "Cache-Control": "no-store" } })
}
