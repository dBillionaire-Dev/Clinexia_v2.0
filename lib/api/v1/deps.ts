import { BUILD_ID } from "@/lib/build-info"
import { supabaseKeyStore } from "../key-store"
import { createRateLimiter } from "../rate-limit"
import type { ApiDeps } from "./kit"

/** Production wiring: Supabase key store and one in-memory limiter per server instance. Tests build their own ApiDeps. */
const limiter = createRateLimiter()
export const apiDeps: ApiDeps = { store: supabaseKeyStore, limiter, buildId: BUILD_ID }
