// Keeps each person's photo in the Supabase "avatars" bucket (one file per account). Server only: uses the service role key.
import { avatarPublicUrl } from "./avatar"
import { uuid } from "./db"

function conn() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
  return { url: url.replace(/\/$/, ""), key }
}

export async function putAvatar(userId: string, bytes: Buffer): Promise<string> {
  const { url, key } = conn()
  const res = await fetch(`${url}/storage/v1/object/avatars/${uuid(userId)}.jpg`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "max-age=3600" },
    body: new Uint8Array(bytes),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Supabase storage upload failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 150)}`)
  return avatarPublicUrl(url, userId, Date.now())
}

export async function removeAvatar(userId: string): Promise<void> {
  const { url, key } = conn()
  const res = await fetch(`${url}/storage/v1/object/avatars/${uuid(userId)}.jpg`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" })
  if (!res.ok && res.status !== 404 && res.status !== 400) throw new Error(`Supabase storage delete failed (${res.status})`)
}
