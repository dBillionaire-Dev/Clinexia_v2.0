// Server-side input checks for sign-up and organisation details. Same style as lib/feedback: hand-written, pure, testable.
import { BACKGROUND, rolesFor } from "../feedback/questions"
import { ORGANISATION_TYPES } from "./config"
import { isEmail, normalizeEmail } from "./invitations"

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const text = (v: unknown, min: number, max: number): string | null => {
  if (typeof v !== "string") return null
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/[\u0000-\u001F\u007F]/g, "").trim()
  return t.length >= min && t.length <= max ? t : null
}

export interface SignupInput { email: string; password: string; fullName: string; accountType: "individual" | "enterprise"; background?: string; role?: string }

export function validateSignup(input: unknown): Result<SignupInput> {
  if (!input || typeof input !== "object") return { ok: false, error: "No details received." }
  const a = input as Record<string, unknown>
  const email = typeof a.email === "string" ? normalizeEmail(a.email) : ""
  if (!isEmail(email)) return { ok: false, error: "Enter a valid email address." }
  const password = typeof a.password === "string" ? a.password : ""
  if (password.length < 10 || password.length > 128) return { ok: false, error: "Use a password of 10 to 128 characters." }
  const fullName = text(a.fullName, 2, 100)
  if (!fullName) return { ok: false, error: "Enter your name." }
  if (a.accountType !== "individual" && a.accountType !== "enterprise") return { ok: false, error: "Choose an account type." }

  let background: string | undefined
  let role: string | undefined
  if (a.accountType === "individual") {
    background = BACKGROUND.find((b) => b.value === a.background)?.value
    if (!background) return { ok: false, error: "Say whether you work in healthcare." }
    role = rolesFor(background).find((r) => r.value === a.role)?.value
    if (!role) return { ok: false, error: "Choose what describes you best." }
  }
  return { ok: true, value: { email, password, fullName, accountType: a.accountType, background, role } }
}

export interface OrganisationInput { name: string; orgType: string; contactPhone?: string; country?: string }

export function validateOrganisation(input: unknown): Result<OrganisationInput> {
  if (!input || typeof input !== "object") return { ok: false, error: "No details received." }
  const a = input as Record<string, unknown>
  const name = text(a.name, 2, 120)
  if (!name) return { ok: false, error: "Enter the organisation name." }
  const orgType = ORGANISATION_TYPES.find((t) => t.value === a.orgType)?.value
  if (!orgType) return { ok: false, error: "Choose the organisation type." }
  const contactPhone = a.contactPhone === undefined || a.contactPhone === "" ? undefined : text(a.contactPhone, 5, 30) ?? undefined
  const country = a.country === undefined || a.country === "" ? undefined : text(a.country, 2, 60) ?? undefined
  return { ok: true, value: { name, orgType, contactPhone, country } }
}

export interface ProfileUpdate { fullName: string; background?: string; role?: string }

/** "Your details" on the account page. Organisation administrators have only a name; individuals also say whether they work in healthcare and their role. */
export function validateProfileUpdate(input: unknown, accountType: "individual" | "enterprise"): Result<ProfileUpdate> {
  if (!input || typeof input !== "object") return { ok: false, error: "No details received." }
  const a = input as Record<string, unknown>
  const fullName = text(a.fullName, 2, 100)
  if (!fullName) return { ok: false, error: "Enter your name (2 to 100 characters)." }
  if (accountType !== "individual") return { ok: true, value: { fullName } }
  const background = BACKGROUND.find((b) => b.value === a.background)?.value
  if (!background) return { ok: false, error: "Say whether you work in healthcare." }
  const role = rolesFor(background).find((r) => r.value === a.role)?.value
  if (!role) return { ok: false, error: "Choose what describes you best." }
  return { ok: true, value: { fullName, background, role } }
}
