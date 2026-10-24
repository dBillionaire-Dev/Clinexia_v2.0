# Integration findings

_Kept up to date by every phase. Anything not verified is listed under UNVERIFIED; nothing here claims a thing works unless it was run._

## Phase 0 baseline

- Date: 2026-10-24
- Install / typecheck / test / build: install: pass; typecheck: pass; test: pass; build: pass; 
- Test summary line: Tests  980 passed (980)
- Backup files (`*.bak*`) were removed in their own commit and `*.bak*` is now in `.gitignore`.

## Flagged files

- `supabase/analytics (2).sql` looks like an accidental duplicate of `supabase/analytics.sql` (space and "(2)" in the name, usually left by a browser download).
  **It was not deleted.** A person should diff it against `analytics.sql` and `analytics-fix-2026-10.sql` and decide whether it is needed.

## UNVERIFIED items

_None yet._

## Suspected formula issues (not fixed)

_None yet._

## Reference gaps summary

_Filled in by Phase 3._

## Decisions needed

_Filled in by Phases 1-8._

## Phase 1 (prefill deep links and embed mode)

### UNVERIFIED (reasoned, not confirmed in a browser or a deployed build)

- `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin` (production only) should not stop `/embed` being framed: COOP governs top-level windows and CORP governs subresource loads, and the embed loads its own assets from its own origin. Reasoned from the specifications. Confirm with the manual checklist in `docs/integration/embed.md` after the first deployment.
- `next.config.mjs` now excludes `/embed` from the global header rule with the source pattern `/((?!embed/|embed$).*)`. The unit test checks the pattern as a regular expression; whether the Next.js version in use accepts it was verified only by `pnpm build` passing on the machine that ran the script.
- The `ready` message type and `calculate: true` in the parent-to-child message are additions beyond the original brief, kept because the parent cannot know when the embed can receive a prefill.
- Embed view with `?theme=` can flash the system theme for a moment before the forced theme applies (theme is enforced through next-themes after hydration; an inline script sets the class earlier).

### Behaviour worth knowing

- History saving in the normal calculator calls analytics (`useHistory.record` -> `trackCalculation`). The embed view therefore skips history, usage tracking and favourites entirely. A structural test (`lib/integration/embed-no-phi.test.ts`) guards this; it cannot prove runtime behaviour, so use the network-tab check in `embed.md`.
- A deep link with `calculate=1` on the NORMAL calculator page behaves like a user pressing Calculate: it saves to local history and reports a usage event, as any calculation there does.
- The service worker no longer caches `/embed/*` navigations, nor `/calculators/*` or `/conversions/*` navigations that carry a query string (the cache key is the full URL, and prefill values can be patient data). The plain pages are cached as before.
- `/embed` still goes through the premium gate (a no-op unless locking is on). Dosing and oncology calculators can be embedded; only the API (Phase 4) gates dosing by key scope.
- Deep-link unit params (`creatinine_unit=umol/L`) are accepted only when equal to the input's own unit until Phase 2 plugs in the conversion-backed resolver.
- No render test for the embed route: `vitest.config.ts` only runs `*.test.ts` in a node environment, and the calculator runner depends on browser-only hooks. Structural tests plus the manual checklist cover it instead.

### Decisions needed

- Should dosing / oncology calculators be embeddable by partners at all, or only after a per-partner opt-in?
- Partner onboarding for `embed_partners` (who adds origins, how they are verified). Run `supabase/embed-partners.sql` once in the Supabase SQL editor.
