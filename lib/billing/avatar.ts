// Profile photo rules. Pure and tested. The browser shrinks the chosen picture to a small JPEG first; the server still checks
// everything itself (size, that it really is a JPEG) because it never trusts what the browser says.

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export type AvatarSource = "upload" | "google"

const httpsUrl = (v: unknown): string | null => (typeof v === "string" && v.length <= 600 && /^https:\/\/[^\s"'<>]+$/.test(v) ? v : null)

/**
 * The photo shown for a person: the one they uploaded, else the photo of the Google account they signed in with (Supabase stores it
 * as avatar_url / picture), else none. An uploaded photo is kept under its own key so a later Google sign-in cannot overwrite it.
 */
export function avatarFromMetadata(meta: unknown): { url: string; source: AvatarSource } | null {
  if (!meta || typeof meta !== "object") return null
  const m = meta as Record<string, unknown>
  const own = httpsUrl(m.clinexia_avatar)
  if (own) return { url: own, source: "upload" }
  const google = httpsUrl(m.avatar_url) ?? httpsUrl(m.picture)
  return google ? { url: google, source: "google" } : null
}

export type DecodedAvatar = { ok: true; bytes: Buffer } | { ok: false; error: string }

/** The uploaded picture arrives as base64 text of a JPEG. */
export function decodeAvatar(input: unknown): DecodedAvatar {
  if (typeof input !== "string" || input.length === 0) return { ok: false, error: "Choose a photo first." }
  const b64 = input.replace(/^data:image\/jpeg;base64,/, "")
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { ok: false, error: "That photo could not be read. Try a different one." }
  const bytes = Buffer.from(b64, "base64")
  if (bytes.length > MAX_AVATAR_BYTES) return { ok: false, error: "The photo must be 2 MB or smaller." }
  if (bytes.length < 200 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { ok: false, error: "That photo could not be read. Use a JPEG or PNG picture." }
  return { ok: true, bytes }
}

/** The address a stored photo is shown from (a public bucket). `version` makes browsers fetch the new one after a change. */
export const avatarPublicUrl = (supabaseUrl: string, userId: string, version: number) => `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/avatars/${userId}.jpg?v=${version}`
