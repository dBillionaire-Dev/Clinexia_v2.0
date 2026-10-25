import { apiDeps } from "@/lib/api/v1/deps"
import { calculatorHandler } from "@/lib/api/v1/handlers"
import { runApi } from "@/lib/api/v1/kit"

export const dynamic = "force-dynamic"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return runApi(request, apiDeps, calculatorHandler, await context.params)
}
