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
