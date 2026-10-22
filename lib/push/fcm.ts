// Sends phone notifications through Firebase Cloud Messaging (HTTP v1). Server only. No Firebase library is needed: the service
// account signs a short-lived token (RS256) which Google exchanges for an access token.
import { createSign } from "node:crypto"

export interface ServiceAccount { client_email: string; private_key: string; project_id: string; token_uri?: string }
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging"

/** FCM_SERVICE_ACCOUNT_JSON: the downloaded key file's contents, either as is or base64-encoded. */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null
  const attempt = (text: string): ServiceAccount | null => {
    try {
      const j = JSON.parse(text)
      return j && typeof j.client_email === "string" && typeof j.private_key === "string" && typeof j.project_id === "string" ? { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n"), project_id: j.project_id, token_uri: typeof j.token_uri === "string" ? j.token_uri : undefined } : null
    } catch { return null }
  }
  return attempt(raw.trim()) ?? attempt(Buffer.from(raw.trim(), "base64").toString("utf8"))
}

const b64url = (v: string) => Buffer.from(v).toString("base64url")

export function buildJwt(sa: ServiceAccount, nowSeconds: number): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri ?? "https://oauth2.googleapis.com/token", iat: nowSeconds, exp: nowSeconds + 3600 }))
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key).toString("base64url")
  return `${header}.${claims}.${signature}`
}

let cached: { token: string; until: number } | null = null
export async function getAccessToken(sa: ServiceAccount, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<string> {
  if (cached && cached.until > now + 60_000) return cached.token
  const res = await fetchImpl(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${buildJwt(sa, Math.floor(now / 1000))}`,
  })
  const j = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null
  if (!res.ok || !j?.access_token) throw new Error(`Google sign-in for notifications failed (${res.status})`)
  cached = { token: j.access_token, until: now + (j.expires_in ?? 3600) * 1000 }
  return j.access_token
}

export interface PushPayload { title: string; body: string; url?: string; id?: string }

export function buildMessage(token: string, p: PushPayload) {
  return { message: { token, notification: { title: p.title, body: p.body }, data: { ...(p.url ? { url: p.url } : {}), ...(p.id ? { id: p.id } : {}) }, android: { priority: "HIGH" } } }
}

export type SendResult = "sent" | "unregistered" | "failed"

export async function sendOne(sa: ServiceAccount, accessToken: string, token: string, p: PushPayload, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  try {
    const res = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(sa.project_id)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildMessage(token, p)),
    })
    if (res.ok) return "sent"
    const text = await res.text().catch(() => "")
    // A token that no longer exists (app uninstalled or data cleared) is removed so it is not tried again.
    return res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/.test(text) ? "unregistered" : "failed"
  } catch { return "failed" }
}

/** Sends to many devices, ten at a time. */
export async function sendToDevices(sa: ServiceAccount, tokens: string[], p: PushPayload, fetchImpl: typeof fetch = fetch) {
  const accessToken = await getAccessToken(sa, fetchImpl)
  const out = { sent: 0, failed: 0, unregistered: [] as string[] }
  let next = 0
  await Promise.all(Array.from({ length: Math.min(10, tokens.length) }, async () => {
    while (next < tokens.length) {
      const token = tokens[next++]
      const r = await sendOne(sa, accessToken, token, p, fetchImpl)
      if (r === "sent") out.sent++
      else if (r === "unregistered") out.unregistered.push(token)
      else out.failed++
    }
  }))
  return out
}
