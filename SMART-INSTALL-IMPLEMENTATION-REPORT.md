# Clinexia Smart Install implementation report

## Files changed

### Added
- `components/SmartInstall.tsx` — custom client-side install bottom sheet, standalone-mode check, eight-hour dismissal cooldown, browser install-event handling, device routing, and manual Apple installation guidance.
- `SMART-INSTALL-IMPLEMENTATION-REPORT.md` — this change summary and deployment notes.

### Modified
- `app/layout.tsx` — replaces the old `InstallPrompt` mount with `SmartInstall` in the root layout. The root layout remains a Server Component.

### Deleted
- None. The legacy `components/install-prompt.tsx` file is retained but is no longer mounted from the root layout.

## Environment configuration

The implementation reuses existing public environment variables and does not change `vercel.json`:

- Android APK URL: `NEXT_PUBLIC_APK_URL` first, then `NEXT_PUBLIC_CLINEXIA_APK_URL`, then `/downloads/Clinexia-latest.apk` as the fallback.
- Microsoft Store URL: `NEXT_PUBLIC_MS_STORE_URL` first, then `NEXT_PUBLIC_CLINEXIA_MICROSOFT_STORE_URL`.

These `NEXT_PUBLIC_*` values are embedded at build time. Confirm they are configured for the correct Vercel deployment environment and redeploy after changing them. No secrets should be placed in `NEXT_PUBLIC_*` variables.

## Behavior and limitations

- Prompt eligibility is limited to `/`, `/welcome`, `/app`, and nested `/app/*` routes.
- Standalone PWA mode is checked before reading the dismissal timestamp.
- Dismissal is stored under `clinexia-install-dismissed` for eight hours.
- `beforeinstallprompt` is intercepted when available; a two-second fallback supports browsers that do not dispatch it.
- Android uses the configured APK URL; Windows uses the configured Microsoft Store URL; iOS and macOS show installation instructions.
- Browsers cannot universally detect a separately installed native APK from a normal website tab. Standalone detection can reliably cover supported installed PWA contexts, not every separate native installation.
- The provided source archive did not contain `public/downloads/Clinexia-latest.apk`. The app therefore depends on the configured APK URL for a working Android download, or that fallback asset must be added to the project.

## Validation

- Inspected the existing root layout, existing install prompt, platform helpers, landing configuration, environment example, `vercel.json`, and package scripts.
- Confirmed no changes were made to service-worker files, APK updater logic, `vercel.json`, or dependency manifests.
- Automated TypeScript/build checks could not be run in this environment because dependencies were not installed and package-manager bootstrap could not reach the npm registry. Run `pnpm typecheck`, `pnpm lint`, and `pnpm build` in the project environment before deploying.
