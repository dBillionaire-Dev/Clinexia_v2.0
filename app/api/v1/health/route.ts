import { apiDeps } from "@/lib/api/v1/deps"
import { healthResponse } from "@/lib/api/v1/handlers"

export const dynamic = "force-dynamic"

export const GET = () => healthResponse(apiDeps.buildId)
