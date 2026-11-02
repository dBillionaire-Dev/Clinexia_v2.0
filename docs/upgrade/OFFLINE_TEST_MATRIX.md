<!-- clinexia-upgrade:phase3 -->
# Offline test matrix

Automated tests cover the logic (service-worker precache behaviour, cache rules). They cannot replace testing on a real
device. Do this on a **production build**, before every release that touches the app shell.

Record each result as PASS / FAIL with the date, device, OS/browser version and app version.

## Web (installed PWA or browser)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| W1 | Fresh install, then offline | Clear site data. Open the site online, wait 60 s on the home page. Turn on airplane mode. Open a calculator you have **never** opened (for example HAS-BLED). | Page loads **and the form works** (inputs respond, Calculate gives a result). |
| W2 | Partial cache is reported | In DevTools > Network block one `/calculators/...` URL, reinstall the service worker, go offline. | The "You are offline" notice mentions pages that were not saved. |
| W3 | Return to online | Re-enable network. | Offline notice disappears without a reload. |
| W4 | Update while online | Deploy a new build, reload twice. | New version active; old caches (`clinexia-*-v5`) removed. |
| W5 | Update interrupted | Start an update, go offline mid-way. | Previous version keeps working. |
| W6 | Low storage | Fill browser storage (DevTools > Application > Storage > simulate quota). | App still starts; no crash; calculators work. |
| W7 | Sign-in offline | Try to sign in offline. | Clear message, no crash. Calculators remain usable. |
| W8 | Shared device | Save patient values, press **New patient**. Reload. | Nothing is offered. Repeat: leave the tab idle for 30 min, return. Nothing is offered. |

## Android (release APK/AAB on a physical phone)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| A1 | First launch offline | Install, enable airplane mode **before** first launch. | All calculators open and work. |
| A2 | Offline during use | Use a calculator, turn on airplane mode, keep using it. | No error; "You are offline" notice shows; results still compute. |
| A3 | Keyboard | Focus a number field in a long form. | Bottom bar hides; the field stays visible; closing the keyboard restores the bar. |
| A4 | Back button | Press system Back from a calculator, a category and Home. | Goes back one level; from Home it leaves the app, not a blank screen. |
| A5 | Rotate / resize | Rotate the phone with a result showing. | Layout adapts; inputs and result are kept (or cleanly reset), no overlap with system bars. |
| A6 | Font scale | Set system font size to the largest. | Text is readable; no clipped buttons in guided mode or results. |
| A7 | Backup exclusion | `adb shell bmgr backupnow com.clinexia.app` then inspect the backup, or restore to a second device. | Sign-in tokens are **not** restored (user must sign in again). Favorites and history are not restored either (see Phase 3 notes). |
| A8 | Process death | Open a calculator with values entered, then kill the app from recents. Reopen. | App opens cleanly. Patient values for the session are gone (by design). |
| A9 | Small screen | Test on a 360 x 640 dp device. | No horizontal scroll; touch targets at least 44 px. |

## Rollback

If any W1 or A1 fails, do not release. Phase 3 edits are backed up in `.clinexia-upgrade-backup/phase3/` and committed on
branch `upgrade/phase-3-offline-android`; `git revert` that commit to roll back.
