import { apiDeps } from "@/lib/api/v1/deps"
import { calculateHandler } from "@/lib/api/v1/handlers"
import { runApi } from "@/lib/api/v1/kit"

export const dynamic = "force-dynamic"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return runApi(request, apiDeps, calculateHandler, await context.params)
}
