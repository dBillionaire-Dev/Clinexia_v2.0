import { apiDeps } from "@/lib/api/v1/deps"
import { catalogHandler } from "@/lib/api/v1/handlers"
import { runApi } from "@/lib/api/v1/kit"

export const dynamic = "force-dynamic"

export const GET = (request: Request) => runApi(request, apiDeps, catalogHandler)
