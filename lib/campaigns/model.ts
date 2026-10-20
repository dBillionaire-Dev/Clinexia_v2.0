// Admin-configurable notices and review forms ("campaigns"). Pure rules: what a valid campaign is, and when it is live.
export const QUESTION_TYPES = ["rating", "text", "choice", "multi", "yesno"] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]
export interface Question { id: string; type: QuestionType; label: string; options?: string[]; required: boolean }

export type Kind = "notice" | "form"
export type Presentation = "modal" | "banner" | "toast"
export type Audience = "everyone" | "guests" | "signed_in"
export type Frequency = "once" | "every_visit" | "every_days"
export type Status = "draft" | "active" | "paused"
/** Where a campaign appears: the website, the Android app, or the mobile website. */
export const PLATFORMS = ["web", "android", "mobile_web"] as const
export type Platform = (typeof PLATFORMS)[number]

export interface CampaignFields {
  title: string // admin-only label
  kind: Kind
  presentation: Presentation
  heading: string
  body: string
  ctaLabel: string
  ctaUrl: string
  questions: Question[]
  audience: Audience
  platforms: Platform[]
  frequency: Frequency
  repeatDays: number
  allowLater: boolean
  laterHours: number
  durationSeconds: number | null
  dismissible: boolean
  startsAt: string | null
  endsAt: string | null
  status: Status
}
export interface Campaign extends CampaignFields { id: string; version: number }

export const LIMITS = { title: 120, heading: 120, body: 1000, ctaLabel: 40, ctaUrl: 300, questions: 12, label: 200, options: 12, option: 80, answer: 1000 }

const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null)
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "") // keeps line breaks
const int = (v: unknown, min: number, max: number, fallback: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.floor(Number(v)))) : fallback)
const when = (v: unknown): string | null | "bad" => {
  if (v === null || v === undefined || v === "") return null
  const t = Date.parse(String(v))
  return Number.isFinite(t) ? new Date(t).toISOString() : "bad"
}

export function safeUrl(raw: string): boolean {
  if (raw.startsWith("/")) return !raw.startsWith("//") && !raw.startsWith("/\\")
  return /^https:\/\/[^\s]+$/.test(raw)
}

export type Cleaned<T> = { ok: true; value: T } | { ok: false; error: string }

export function cleanQuestions(raw: unknown): Cleaned<Question[]> {
  if (!Array.isArray(raw)) return { ok: true, value: [] }
  if (raw.length > LIMITS.questions) return { ok: false, error: `Use at most ${LIMITS.questions} questions.` }
  const out: Question[] = []
  const used = new Set<string>()
  for (const [i, q] of raw.entries()) {
    const type = oneOf((q as any)?.type, QUESTION_TYPES)
    const label = clean((q as any)?.label, LIMITS.label)
    if (!type || !label) return { ok: false, error: `Question ${i + 1} needs a type and wording.` }
    let id = clean((q as any)?.id, 30).toLowerCase()
    if (!/^[a-z0-9_]{1,30}$/.test(id) || used.has(id)) id = `q${i + 1}`
    while (used.has(id)) id += "x"
    used.add(id)
    const question: Question = { id, type, label, required: (q as any)?.required !== false }
    if (type === "choice" || type === "multi") {
      const options = Array.isArray((q as any)?.options) ? [...new Set((q as any).options.map((o: unknown) => clean(o, LIMITS.option)).filter(Boolean))] as string[] : []
      if (options.length < 2 || options.length > LIMITS.options) return { ok: false, error: `Question ${i + 1} needs 2 to ${LIMITS.options} options.` }
      question.options = options
    }
    out.push(question)
  }
  return { ok: true, value: out }
}

export function cleanCampaignInput(raw: unknown): Cleaned<CampaignFields> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "No details received." }
  const r = raw as Record<string, unknown>
  const title = clean(r.title, LIMITS.title)
  const heading = clean(r.heading, LIMITS.heading)
  if (!title) return { ok: false, error: "Give the campaign a name (only you see it)." }
  if (!heading) return { ok: false, error: "Write the heading people will see." }
  const kind = oneOf(r.kind, ["notice", "form"] as const)
  const presentation = oneOf(r.presentation, ["modal", "banner", "toast"] as const)
  const audience = oneOf(r.audience, ["everyone", "guests", "signed_in"] as const)
  const frequency = oneOf(r.frequency, ["once", "every_visit", "every_days"] as const)
  const status = oneOf(r.status, ["draft", "active", "paused"] as const)
  if (!kind || !presentation || !audience || !frequency || !status) return { ok: false, error: "Choose the type, how it appears, who sees it, how often and its status." }

  const ctaLabel = clean(r.ctaLabel, LIMITS.ctaLabel)
  const ctaUrl = clean(r.ctaUrl, LIMITS.ctaUrl)
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) return { ok: false, error: "A button needs both its label and its link." }
  if (ctaUrl && !safeUrl(ctaUrl)) return { ok: false, error: "The button link must start with / (a page in the app) or https://." }

  let questions: Question[] = []
  if (kind === "form") {
    const q = cleanQuestions(r.questions)
    if (!q.ok) return q
    if (q.value.length === 0) return { ok: false, error: "Add at least one question to the form." }
    questions = q.value
  }

  const startsAt = when(r.startsAt)
  const endsAt = when(r.endsAt)
  if (startsAt === "bad" || endsAt === "bad") return { ok: false, error: "A date or time is not valid." }
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: "The end must be after the start." }

  let platforms: Platform[] = [...PLATFORMS]
  if (r.platforms !== undefined) {
    const list = Array.isArray(r.platforms) ? [...new Set(r.platforms.filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p as string)))] : []
    if (list.length === 0) return { ok: false, error: "Choose where it shows: the website, the Android app, or the mobile website." }
    platforms = list
  }

  const duration = r.durationSeconds === null || r.durationSeconds === undefined || r.durationSeconds === "" ? null : int(r.durationSeconds, 3, 600, 8)
  return {
    ok: true,
    value: {
      title, kind, presentation, heading, body: clean(r.body, LIMITS.body), ctaLabel, ctaUrl, questions, audience, platforms, frequency,
      repeatDays: int(r.repeatDays, 1, 365, 7), allowLater: r.allowLater !== false, laterHours: int(r.laterHours, 1, 720, 8),
      durationSeconds: presentation === "modal" ? null : duration, dismissible: r.dismissible !== false, startsAt, endsAt, status,
    },
  }
}

/** Live = switched on, started, and not ended. Scheduling needs no job: the clock decides. */
export function isLive(c: Pick<CampaignFields, "status" | "startsAt" | "endsAt">, now: number): boolean {
  if (c.status !== "active") return false
  if (c.startsAt && Date.parse(c.startsAt) > now) return false
  if (c.endsAt && Date.parse(c.endsAt) <= now) return false
  return true
}

export const platformMatches = (c: { platforms?: Platform[] }, platform: Platform) => !c.platforms || c.platforms.includes(platform)

export const audienceMatches = (c: Pick<CampaignFields, "audience">, signedIn: boolean) => c.audience === "everyone" || (c.audience === "signed_in" ? signedIn : !signedIn)

/** What a person typed, checked against the form the admin built. */
export type Answers = Record<string, string | number | string[]>
export function validateResponse(questions: Question[], raw: unknown): Cleaned<Answers> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "No answers received." }
  const a = raw as Record<string, unknown>
  const out: Answers = {}
  for (const q of questions) {
    const v = a[q.id]
    const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)
    if (empty) {
      if (q.required) return { ok: false, error: `Please answer: ${q.label}` }
      continue
    }
    if (q.type === "rating") {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: `Choose 1 to 5 for: ${q.label}` }
      out[q.id] = n
    } else if (q.type === "text") {
      if (typeof v !== "string") return { ok: false, error: `Invalid answer for: ${q.label}` }
      out[q.id] = clean(v, LIMITS.answer)
    } else if (q.type === "yesno") {
      if (v !== "yes" && v !== "no") return { ok: false, error: `Choose yes or no for: ${q.label}` }
      out[q.id] = v
    } else if (q.type === "choice") {
      if (typeof v !== "string" || !q.options?.includes(v)) return { ok: false, error: `Choose one of the options for: ${q.label}` }
      out[q.id] = v
    } else {
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !q.options?.includes(x))) return { ok: false, error: `Invalid choices for: ${q.label}` }
      out[q.id] = [...new Set(v as string[])]
    }
  }
  return { ok: true, value: out }
}
