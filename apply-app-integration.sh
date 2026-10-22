#!/usr/bin/env bash
# Run from the repo root AFTER add-billing.sh. Safe to re-run (already-patched spots are skipped; originals saved as .bak).
# Wires the new account features into your existing app:
#   - premium lock on every specialty calculator page           - themed dialog instead of the browser confirm() box
#   - profile icon in the navbar (sign in / account menu)       - 3-free-calculations allowance for guests (per device)
#   - Free / Premium badges on tool lists and tool pages
#   - feedback reminders fixed (people who answered are not asked again), full feedback browser in admin
#   - Campaigns (notices / review forms the admin configures) shown in the app, and admin nav links
#   - Privacy, terms, landing page and README reflect accounts, plans, device linking, campaigns and notifications
#   - Mobile app access: lets the Clinexia Android app and mobile site use the accounts, plans and campaigns here
# Everything stays inactive until BILLING_ENFORCE_PREMIUM=true (the navbar icon shows whenever accounts are on).
set -euo pipefail
[ -f components/account/premium-gate.tsx ] && [ -f components/account/guest-guard.tsx ] || { echo "Run add-billing.sh first."; exit 1; }

python3 - <<'PY'
import os, shutil, sys

def load(path):
    if not os.path.exists(path):
        sys.exit(f"Missing {path}. Run this from the repo root.")
    return open(path, encoding="utf-8").read()

def patch(path, edits, import_after, import_line, label=None):
    """edits: (old, new, expected_count). Aborts this file, writing nothing, if anything is not as expected."""
    s = load(path)
    if import_line in s:
        print(f"skip    {path} ({label or 'already patched'})")
        return
    for old, _, n in edits:
        found = s.count(old)
        if found != n:
            sys.exit(f"Could not patch {path}: expected {n} match(es) of\n  {old[:100]!r}\nbut found {found}. The file has changed; nothing was written for it.")
    if import_after not in s:
        sys.exit(f"Could not patch {path}: import anchor not found: {import_after}")
    shutil.copyfile(path, path + ".bak")
    for old, new, _ in edits:
        s = s.replace(old, new)
    s = s.replace(import_after, import_after + "\n" + import_line, 1)
    open(path, "w", encoding="utf-8").write(s)
    print(f"patched {path}" + (f" ({label})" if label else ""))

GATE = 'import { PremiumGate } from "@/components/account/premium-gate"'
BADGE = 'import { AccessBadge } from "@/components/account/access-badge"'
PC = 'import { PageContainer } from "@/components/page-container"'
BADGE_AT = lambda v: f'<AccessBadge id={{{v}.id}} category={{{v}.category}} />'

# 1. premium lock: shared calculator runner
path = "components/calculators/calculator-runner.tsx"
s = load(path)
if "CalculatorRunnerInner" in s:
    print(f"skip    {path} (lock already applied)")
else:
    old = "export function CalculatorRunner({ calculatorId }: { calculatorId: string }) {"
    if old not in s or 'import Link from "next/link"' not in s:
        sys.exit(f"Could not patch {path}: expected text not found.")
    shutil.copyfile(path, path + ".bak")
    s = s.replace(old, "function CalculatorRunnerInner({ calculatorId }: { calculatorId: string }) {", 1)
    s = s.replace('import Link from "next/link"', 'import Link from "next/link"\n' + GATE, 1)
    s = s.rstrip() + '\n\n/** Public entry point: the runner behind the premium lock (a no-op unless locking is switched on). */\nexport function CalculatorRunner({ calculatorId }: { calculatorId: string }) {\n  return (\n    <PremiumGate id={calculatorId}>\n      <CalculatorRunnerInner calculatorId={calculatorId} />\n    </PremiumGate>\n  )\n}\n'
    open(path, "w", encoding="utf-8").write(s)
    print(f"patched {path} (lock)")
# ...and its badges (title + related tools)
patch(path, [
    ("<CardTitle>{definition.name}</CardTitle>", "<CardTitle>{definition.name}" + BADGE_AT("definition") + "</CardTitle>", 1),
    ("{tool.shortName ?? tool.name}\n                </Badge>", "{tool.shortName ?? tool.name}" + BADGE_AT("tool") + "\n                </Badge>", 1),
], GATE, BADGE, "badges")

# 2. premium lock: dedicated pages that do not use the shared runner
for page, comp, cat in [
    ("app/calculators/hematology/red-cell-indices/page.tsx", "<RedCellIndicesCalculator />", "hematology"),
    ("app/lab-tools/dilution/page.tsx", "<DilutionCalculator />", "lab-solutions"),
    ("app/lab-tools/serial-dilution/page.tsx", "<SerialDilutionCalculator />", "lab-solutions"),
    ("app/lab-tools/percentage-solution/page.tsx", "<PercentageSolutionCalculator />", "lab-solutions"),
]:
    patch(page, [(comp, f'<PremiumGate category="{cat}">{comp}</PremiumGate>', 1)], PC, GATE, "lock")
patch("app/lab-tools/spectrophotometry/page.tsx", [
    ('      <div className="space-y-8">\n        <BeerLambertCalculator />', '      <PremiumGate category="spectrophotometry">\n      <div className="space-y-8">\n        <BeerLambertCalculator />', 1),
    ('      </div>\n    </PageContainer>', '      </div>\n      </PremiumGate>\n    </PageContainer>', 1),
], PC, GATE, "lock")

# 3. themed confirm dialog in the existing admin user management
patch("components/admin-user-management.tsx", [('''    const confirmed = window.confirm(
      `Delete ${user.displayName}? This removes the user's anonymous device record and all calculation history from analytics. This cannot be undone.`,
    )''', '''    const confirmed = await confirmDialog({
      title: `Delete ${user.displayName}?`,
      description: "This removes the user's anonymous device record and all calculation history from analytics. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    })''', 1)], 'import { Pencil, Save, Trash2, X } from "lucide-react"', 'import { confirmDialog } from "@/components/ui/app-dialogs"', "dialog")

# 4. navbar profile icon
patch("components/header.tsx", [("<ThemeToggle />", "<ThemeToggle />\n            <AccountMenu />", 1)],
      'import { ThemeToggle } from "@/components/theme-toggle"', 'import { AccountMenu } from "@/components/account/account-menu"', "navbar icon")

# 5. guest allowance guard, mounted once for the whole app
patch("components/app-chrome.tsx", [("    <ChromeGate>\n      <Header />\n    </ChromeGate>", "    <>\n      <ChromeGate>\n        <Header />\n      </ChromeGate>\n      <GuestGuard />\n    </>", 1)],
      'import { ChromeGate } from "@/components/landing/chrome-gate"', 'import { GuestGuard } from "@/components/account/guest-guard"', "guest guard")

# 6. count guest calculations where every calculation is already reported
patch("lib/analytics/track-calculation.ts", [('if (typeof window !== "undefined" && window.self !== window.top) return',
    'if (typeof window !== "undefined" && window.self !== window.top) return\n\n    // Guest allowance: counts only while premium locking is on and nobody is signed in.\n    try {\n      const guest = noteGuestCalculation(window.localStorage)\n      if (guest.counted) window.dispatchEvent(new CustomEvent("clinexia:guest-calc", { detail: guest }))\n    } catch {\n      /* the allowance must never break calculating */\n    }', 1)],
      'import { getPlatform } from "@/lib/platform"', 'import { noteGuestCalculation } from "@/lib/billing/guest"', "guest count")

# 7. Free / Premium badges on tool lists
CAT_OLD = '{tool.isEstimator ? <Badge variant="secondary">Estimator</Badge> : null}'
CAT_NEW = '<div className="flex shrink-0 items-center gap-2">' + CAT_OLD + '<AccessBadge id={tool.id} category={tool.category} className="ml-0" /></div>'
patch("app/calculators/[category]/page.tsx", [(CAT_OLD, CAT_NEW, 2)], 'import { Badge } from "@/components/ui/badge"', BADGE, "badges")
TITLE_OLD = '<CardTitle className="text-base">{tool.name}</CardTitle>'
TITLE_NEW = '<CardTitle className="text-base">{tool.name}' + BADGE_AT("tool") + '</CardTitle>'
for page, anchor in [("app/estimators/page.tsx", PC), ("app/recent/page.tsx", PC), ("app/favorites/page.tsx", PC)]:
    patch(page, [(TITLE_OLD, TITLE_NEW, 1)], anchor, BADGE, "badges")
patch("app/page.tsx", [
    ("{tool.shortName ?? tool.name}\n                </Badge>", "{tool.shortName ?? tool.name}" + BADGE_AT("tool") + "\n                </Badge>", 1),
    ("{tool.name}</CardContent>", "{tool.name}" + BADGE_AT("tool") + "</CardContent>", 2),
], 'import Link from "next/link"', BADGE, "badges")
# 8. feedback reminders: an answer must never be erased or ignored
def edit_only(path, edits, label=None):
    s = load(path)
    if all(new in s for _, new, _ in edits):
        print(f"skip    {path} ({label or 'already patched'})")
        return
    for old, _, n in edits:
        if s.count(old) != n:
            sys.exit(f"Could not patch {path}: expected {n} match(es) of\n  {old[:100]!r}\nbut found {s.count(old)}. Nothing was written for it.")
    shutil.copyfile(path, path + ".bak")
    for old, new, _ in edits:
        s = s.replace(old, new)
    open(path, "w", encoding="utf-8").write(s)
    print(f"patched {path}" + (f" ({label})" if label else ""))

patch("lib/feedback/client.ts", [
    ('''export function writeState(state: FeedbackState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {}
}''', '''export function writeState(state: FeedbackState): void {
  try {
    // Never let an older copy of the state erase an answer that was already recorded.
    let stored: unknown = null
    try {
      stored = JSON.parse(localStorage.getItem(STATE_KEY) ?? "null")
    } catch {}
    localStorage.setItem(STATE_KEY, JSON.stringify(preserveCompletion(stored, state)))
  } catch {}
}''', 1),
    ('export const defaultVersion = DEFAULT_CONFIG.version', '''/** Has this device already answered this round? Stored on the server, so it still holds if this device's saved state was lost. */
export async function checkAnsweredOnServer(version: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/feedback/answered?v=${version}&aid=${encodeURIComponent(getAnonymousId())}`, { cache: "no-store" })
    if (!res.ok) return false
    return ((await res.json()) as { answered?: boolean }).answered === true
  } catch {
    return false
  }
}

export const defaultVersion = DEFAULT_CONFIG.version''', 1),
], 'import { DEFAULT_CONFIG, normalizeState, parseConfig, type FeedbackConfig, type FeedbackState } from "./schedule"', 'import { preserveCompletion } from "./preserve"', "keep answers")

patch("components/feedback-prompt.tsx", [
    ('''    const c = config.current
    const s = state.current
    if (!c || !s) return''', '''    const c = config.current
    if (!c) return
    // Judge from what is saved right now: the form (or another tab) may have recorded an answer since this popup loaded.
    const s = readState(c.version)
    state.current = s''', 1),
    ('''      writeState(state.current)
      void evaluate()''', '''      writeState(state.current)
      // An answer already stored on the server for this device and round counts, even if this device's saved state was lost.
      void checkAnsweredOnServer(loaded.version).then((answered) => {
        if (!answered) return
        writeState(markDone(readState(loaded.version), Date.now()))
        state.current = readState(loaded.version)
        setVisible(false)
      })
      void evaluate()''', 1),
    ('  const save = (next: FeedbackState) => {', '''  // The form announces when it is sent, so the popup goes away at once and cannot come back for this round.
  useEffect(() => {
    const refresh = () => { setVisible(false); void evaluate() }
    window.addEventListener("clinexia:feedback-done", refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener("clinexia:feedback-done", refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [evaluate])

  const save = (next: FeedbackState) => {''', 1),
    ('save(pauseForHours(state.current as FeedbackState, Date.now(), 1))', 'save(pauseForHours(readState((config.current as FeedbackConfig).version), Date.now(), 1))', 1),
    ('save(snooze(state.current as FeedbackState, config.current as FeedbackConfig, Date.now()))', 'save(snooze(readState((config.current as FeedbackConfig).version), config.current as FeedbackConfig, Date.now()))', 1),
], 'import { localDay, loadConfig, readState, writeState } from "@/lib/feedback/client"',
   'import { checkAnsweredOnServer } from "@/lib/feedback/client"\nimport { markDone } from "@/lib/feedback/schedule"', "reminders")

edit_only("components/feedback-form.tsx", [
    ("    writeState(markDone(readState(version), Date.now()))\n", "    writeState(markDone(readState(version), Date.now()))\n    window.dispatchEvent(new Event(\"clinexia:feedback-done\"))\n", 1),
], "announce answer")

# 9. admin feedback: every response, a page at a time, click to read everything
path = "app/admin/feedback/page.tsx"
s = load(path)
if "FeedbackBrowser" in s:
    print(f"skip    {path} (already patched)")
else:
    start = s.find("        <Section title={`What people wrote")
    end = s.rfind("        </Section>\n      </div>\n    </main>")
    if start < 0 or end < 0 or end < start:
        sys.exit(f"Could not patch {path}: the 'What people wrote' section was not found. Nothing was written.")
    end += len("        </Section>\n")
    new_section = '        <Section title={`All feedback (${rows.length})`}>\n          <FeedbackBrowser rows={browserRows} deleteAction={removeResponse} />\n        </Section>\n'
    mapping = '''  const optional = (label: string, value: string | null | undefined): [string, string][] => (value ? [[label, value]] : [])
  const browserRows = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    rating: r.rating,
    role: labelOf([...MED_ROLES, ...NON_MED_ROLES], r.role),
    texts: { improve: r.improve, missing: r.missing, other: r.other },
    details: [
      ["Healthcare background", labelOf(BACKGROUND, r.background)],
      ["Role", labelOf([...MED_ROLES, ...NON_MED_ROLES], r.role)],
      ["Devices", r.devices.map((d) => labelOf(DEVICES, d)).join(", ") || "None"],
      ["Used for", labelOf(USE_CONTEXT, r.use_context) + (r.office_type ? `, ${labelOf(OFFICE_TYPES, r.office_type)}` : "")],
      ["Would pay", labelOf(PAY_INTEREST, r.pay_interest)],
      ...optional("Price per person / month", r.price_individual ? labelOf(PRICE_INDIVIDUAL, r.price_individual) : null),
      ...optional("Team price", r.price_team ? labelOf(PRICE_TEAM, r.price_team) : null),
      ...optional("Who would pay", r.pay_who ? labelOf(PAY_WHO, r.pay_who) : null),
      ["Platform", r.platform ?? "unknown"],
      ["App version", r.app_version ?? "unknown"],
      ["Round", String(r.survey_version)],
    ] as [string, string][],
  }))
'''
    anchor = '  const btn = "rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"\n'
    if anchor not in s or "  const texts = " not in s:
        sys.exit(f"Could not patch {path}: expected lines not found. Nothing was written.")
    shutil.copyfile(path, path + ".bak")
    s = s[:start] + new_section + s[end:]
    s = s.replace(anchor, anchor + mapping, 1)
    s = "\n".join(l for l in s.split("\n") if not l.startswith("  const texts = "))
    if "DEVICES" not in s.split("export const dynamic")[0]:
        s = s.replace("import { BACKGROUND, labelOf,", "import { BACKGROUND, DEVICES, labelOf,", 1)
    s = s.replace('import { AdminNav, Card, Section, num, pct } from "@/components/admin/traction-ui"', 'import { AdminNav, Card, Section, num, pct } from "@/components/admin/traction-ui"\nimport { FeedbackBrowser } from "@/components/admin/feedback-browser"', 1)
    open(path, "w", encoding="utf-8").write(s)
    print(f"patched {path} (all feedback browser)")

# 10. campaigns shown in the app, and admin navigation
patch("components/app-chrome.tsx", [("      <GuestGuard />\n    </>", "      <CampaignHost />\n      <GuestGuard />\n    </>", 1)],
      'import { GuestGuard } from "@/components/account/guest-guard"', 'import { CampaignHost } from "@/components/campaigns/campaign-host"', "campaigns")
edit_only("components/admin/traction-ui.tsx", [
    ('      {item("/admin/feedback", "Feedback", "feedback")}\n', '      {item("/admin/feedback", "Feedback", "feedback")}\n      {item("/admin/campaigns", "Campaigns", "campaigns")}\n      {item("/admin/accounts", "Accounts management", "accounts")}\n', 1),
], "admin nav")
path = "app/admin/page.tsx"
s = load(path)
LINK = '<Link href="/admin/%s" className="rounded-md border bg-background px-3 py-2 font-medium hover:bg-muted">%s</Link>'
fb = '<Link href="/admin/feedback" className="rounded-md border bg-background px-3 py-2 font-medium hover:bg-muted">Feedback</Link>'
if "/admin/campaigns" in s and "/admin/accounts" in s:
    print(f"skip    {path} (already patched)")
elif fb not in s:
    sys.exit(f"Could not patch {path}: the Feedback button was not found. Add Campaigns and Accounts management links to the nav yourself.")
else:
    shutil.copyfile(path, path + ".bak")
    add = ""
    if "/admin/accounts" not in s: add += "\n          " + LINK % ("accounts", "Accounts management")
    if "/admin/campaigns" not in s: add += "\n          " + LINK % ("campaigns", "Campaigns")
    open(path, "w", encoding="utf-8").write(s.replace(fb, fb + add, 1))
    print(f"patched {path} (admin nav)")

# 11. let the Clinexia mobile apps call the account / billing / campaign / feedback APIs (origin allow-list, preflight)
patch("proxy.ts", [
    ("export function proxy(request: NextRequest) {", "function route(request: NextRequest) {", 1),
    ("export const config = {", '''/**
 * Lets the Clinexia mobile apps (Android app, mobile site) call the account, billing, campaign and feedback APIs.
 * Only origins listed in lib/billing/cors.ts (or MOBILE_ALLOWED_ORIGINS) get CORS headers; everything else is unchanged.
 */
export function proxy(request: NextRequest) {
  const cors = corsPath(request.nextUrl.pathname) ? corsHeadersFor(request.headers.get("origin")) : null
  if (cors && request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: cors })
  const response = route(request)
  if (cors) for (const [key, value] of Object.entries(cors)) response.headers.set(key, value)
  return response
}

export const config = {''', 1),
], 'import { NextResponse, type NextRequest } from "next/server"', 'import { corsHeadersFor, corsPath } from "@/lib/billing/cors"', "mobile access")

# 12. legal pages, landing page and README reflect accounts, plans, device linking, campaigns and notifications
edit_only("lib/legal.ts", [('export const TERMS_LAST_UPDATED = "12 October 2026"', 'export const TERMS_LAST_UPDATED = "20 October 2026"', 1)], "terms date")

TERMS_NEW = """  {
    title: "Accounts",
    body: [
      "You can use many tools without an account. Some features need one. When you register you give a real email address and your name, keep your password to yourself, and keep your details up to date.",
      "An account is for one person. Do not share a login: organisations give each member of staff their own account. You are responsible for what happens under your account.",
    ],
  },
  {
    title: "Free use and limits without an account",
    body: [
      "Some tools are free and some are premium, and the app labels which is which. Without an account you can run a limited number of calculations on each device; after that you can keep browsing but you need an account to keep calculating. We may change which tools are free or premium and how many calculations guests get.",
    ],
  },
  {
    title: "Plans and payments",
    body: [
      "Premium tools are paid. You can buy access to the specialties you choose, or All-access. Prices are shown before you pay, in naira for Nigeria and in dollars elsewhere. Prices can change; a change applies to your next payment, not to one you have already made.",
      "Each payment covers one month and does not renew by itself, so to keep access you pay again. If you cancel, you keep access until the end of the month you paid for. Choosing a different plan starts a new month from the day you pay, and unused time on the old plan is not credited. After a plan ends there may be a short grace period.",
      "Payments are processed by Paystack. We never see or store your card details. If you think a payment was taken in error, contact us and we will look into it.",
    ],
  },
  {
    title: "Organisations",
    body: [
      "An organisation account is run by its owner, who chooses the plan and the number of seats, pays for it and invites staff. Owners and administrators can invite and remove members and decide which specialties each member can use. A seat is for one named person. An invitation reserves a seat until it is accepted, withdrawn or expires. The owner is responsible for the people they invite. Any discount for centrally managed organisations applies only after we have verified it.",
    ],
  },
  {
    title: "Messages and notifications",
    body: [
      "We may show notices and short review forms in the app and on the website, and, if you turn them on, send notifications to your phone. You can close them, and you can switch phone notifications off in your phone's settings.",
    ],
  },
  {
    title: "Suspension and deletion",
    body: [
      "We may suspend or delete an account that is misused, for example by sharing a login, fraud, abuse of the service or the payment system, or attempts to get around limits. We will tell you why. While an account is suspended you cannot sign in. Deleting an account is permanent: it removes the profile, memberships and subscription, and any paid time is lost. You can ask us to delete your account at any time.",
    ],
  },
"""
edit_only("app/terms/page.tsx", [
    ('  {\n    title: "Not medical advice, not a medical device",', TERMS_NEW + '  {\n    title: "Not medical advice, not a medical device",', 1),
    ('Features may become paid in the future; if that happens we will say so in the app.', 'Some tools are free and some are premium, as described above.', 1),
], "accounts, plans and suspension")

edit_only("app/welcome/page.tsx", [
    ('{ q: "Do I need an account?", a: "No. Open it and start calculating." },',
     '{ q: "Do I need an account?", a: "Not to try it. Open it and start calculating; without an account you can run a few calculations on each device. Create a free account to keep going, and choose a premium plan for specialty tools such as laboratory, pharmacy, renal, cardiology and oncology." },\n    { q: "What is free and what is premium?", a: "Some tools are free. Specialty tools are premium: pay monthly for the specialties you use, or choose All-access. Prices are shown in naira in Nigeria and in dollars elsewhere, and each tool is labelled Free or Premium in the app. Organisations can buy seats for their staff." },', 1),
    ('a: "History, favorites and settings stay on your device. Clinexia counts anonymous usage (which tool was used, never the values you enter) to understand how many people use it and which tools matter." },',
     'a: "History, favorites and settings stay on your device, and the values you enter and your results are never sent to us. Without an account Clinexia counts anonymous usage (which tool was used, never the values). If you create an account we keep your name, email and plan, and link your devices\' usage to your account so we can support you." },', 1),
    ('No account needed</li>', 'Try it without an account</li>', 1),
    ('Open it now. No sign-up, no setup.', 'Open it now. Try it without signing up.', 1),
], "account wording")

# the "Private by design" card: replace its paragraph (it is on one long line)
import re as _re
_p = "app/welcome/page.tsx"
_s = load(_p)
_new_card = "Your calculations stay on your device: the values you enter and your results are never sent to us. You can use Clinexia without an account. If you create one, we keep your name, email and plan, and link your anonymous usage to your account. Payments are handled by Paystack and we never see your card details. Please do not enter patient-identifying information."
if "link your anonymous usage to your account" in _s:
    print(f"skip    {_p} (privacy card already patched)")
else:
    _m = _re.search(r"No account\. The values you enter and your results stay on your device\..*?Please do not enter patient-identifying information\.", _s, _re.S)
    if not _m:
        sys.exit(f"Could not patch {_p}: the privacy card text was not found. Nothing was written for it.")
    shutil.copyfile(_p, _p + ".bak2")
    open(_p, "w", encoding="utf-8").write(_s[:_m.start()] + _new_card + _s[_m.end():])
    print(f"patched {_p} (privacy card)")

README_NEW = """
## Accounts, plans, campaigns and the mobile app

Clinexia works without an account. Accounts add premium plans, organisations, and admin tools. Everything is optional until you switch premium locking on.

**What exists**
- Accounts: `/register`, `/login`, `/account` (Supabase Auth). Individual and organisation accounts; organisation owners invite staff, assign specialties and manage seats.
- Plans: Free, Specialty premium, All-access, in naira (Nigeria) or dollars (elsewhere), set by an admin. Paystack payments (one month each, no auto-renewal). Premium locking is OFF until `BILLING_ENFORCE_PREMIUM=true`.
- Guests: 3 calculations per device once locking is on, then browse-only. Tools are labelled Free or Premium.
- Admin: `/admin/accounts` (users, plans, suspend/delete with a notice, organisations, prices, audit, device history), `/admin/campaigns` (notices and review forms, scheduling, where they show, phone notifications), `/admin/setup` (checks this deployment).
- Device linking: a device is linked to the account of the person who registers or signs in on it, so the admin shows their real name and full calculation history (tool names and times only).
- Campaigns: notices and review forms shown on the website and in the Android app; answers and "remind me later" follow the account.
- Phone notifications (Android) through Firebase Cloud Messaging; each notification stays on screen until it is closed.
- The Android/mobile app (separate repo) uses this backend: accounts, plans and campaigns are shared.

**Set up (once per Supabase project)**: run in the SQL editor, in order: `supabase/billing.sql`, `billing-admin.sql`, `billing-link.sql`, `campaigns.sql`, `push.sql` (and `analytics.sql` if not already). Then open `/admin/setup` to confirm.

**Environment variables (Vercel)**
| Variable | Needed for |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | everything (already used by analytics) |
| `SUPABASE_ANON_KEY` | sign-in and registration |
| `PAYSTACK_SECRET_KEY` | payments |
| `FCM_SERVICE_ACCOUNT_JSON` | phone notifications |
| `RESEND_API_KEY`, `BILLING_FROM_EMAIL` | emailed account notices (optional) |
| `BILLING_ENFORCE_PREMIUM=true` | turn premium locking on (default off) |
| `BILLING_ENABLED=false` | switch accounts off completely |
| `MOBILE_ALLOWED_ORIGINS` | extra origins allowed to call the account APIs (testing) |

Full details, limits and the mobile contract are in [`docs/billing.md`](docs/billing.md). The privacy policy (`/privacy`) and terms (`/terms`) describe how accounts, device linking, payments and notifications work.
"""
_r = load("README.md")
if "## Accounts, plans, campaigns and the mobile app" in _r:
    print("skip    README.md (already has the accounts section)")
else:
    shutil.copyfile("README.md", "README.md.bak")
    _r = _r.replace("## Features\n", "## Features\n\n> New: accounts, premium plans, admin tools and an Android app that shares the same backend. See [Accounts, plans, campaigns and the mobile app](#accounts-plans-campaigns-and-the-mobile-app).\n", 1)
    open("README.md", "w", encoding="utf-8").write(_r.rstrip() + "\n" + README_NEW)
    print("patched README.md (accounts section)")

# admin navigation: Setup check
edit_only("components/admin/traction-ui.tsx", [
    ('      {item("/admin/accounts", "Accounts management", "accounts")}\n', '      {item("/admin/accounts", "Accounts management", "accounts")}\n      {item("/admin/setup", "Setup check", "setup")}\n', 1),
], "setup link")
_a = load("app/admin/page.tsx")
if "/admin/setup" not in _a and 'Campaigns</Link>' in _a:
    shutil.copyfile("app/admin/page.tsx", "app/admin/page.tsx.bak")
    _a = _a.replace('Campaigns</Link>', 'Campaigns</Link>\n          <Link href="/admin/setup" className="rounded-md border bg-background px-3 py-2 font-medium hover:bg-muted">Setup check</Link>', 1)
    open("app/admin/page.tsx", "w", encoding="utf-8").write(_a)
    print("patched app/admin/page.tsx (setup link)")
else:
    print("skip    app/admin/page.tsx (setup link)")

PY
echo "Done. Next: pnpm typecheck && pnpm dev"
