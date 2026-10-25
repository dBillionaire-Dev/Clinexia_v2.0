import { apiDeps } from "@/lib/api/v1/deps"
import { batchHandler } from "@/lib/api/v1/handlers"
import { runApi } from "@/lib/api/v1/kit"

export const dynamic = "force-dynamic"

export const POST = (request: Request) => runApi(request, apiDeps, batchHandler)
