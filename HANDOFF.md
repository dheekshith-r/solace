# Solace handoff (Sat 7 Nov 2026)

**APK:** `Desktop\Solace-v1.apk`, 51.2 MB, release build of app code at commit `64203f3` (nothing in the app has changed since; later commits are API and test files). API: `https://solace-api-sg.onrender.com` (Singapore, next to the Mumbai database).
**Branches:** all work on `app-build`; `main` carries only `apps/api` and deploys to Render automatically.
**Rebuild:** `pwsh build-apk.ps1` (steps and requirements are in the script).

## Works (verified)
- **API, live on Singapore:** `/health`, sign-up, log-in, `/today` (first call about 0.35–0.6 s, one DB query, never waits on Gemini), check-ins, resources, `/health/ai`. 382 API tests pass.
- **Sola's lines are grounded:** they never invent details the user didn't log, never claim a mood that wasn't logged, and never name a time of day in lines shown all day. Verified live with fresh accounts.
- **On the phone (Maestro run 1, release APK):** onboarding, sign-up (including the cold-start fix), Today mood tap and the Sola tab worked.
- **Fixed after run 1, built into the APK but not yet re-run on the phone:**
  - new-conversation screen no longer blank;
  - tab bar hidden in conversations;
  - Today: nothing selected until the first tap;
  - Sola tab: single "New conversation" button, no card gap;
  - chat: header with Sola and "Here, no rush", sky background, "Message Sola" placeholder.
- **Mobile checks:** 92 tests pass, plus tsc and lint.

## Untested on the phone
- Run 2 never ran (stopped at step 6 on the pinning issue, now fixed). Not yet seen on the phone:
  - the fixed conversation screen and the tab bar sliding away;
  - Breathe, Reflect, Reminders, You, Resources, Privacy and account deletion.
- **Ticket 08b (Today memory across tab switches):** fixed in code (tabs stay attached, Today pauses while hidden), not measured.
- Notifications and deep links on a release build.
- The 503 rate on Gemini over a full day (`/health/ai`; report if above 1 in 10).

## To run the phone test
1. Unpin Solace, then run `pwsh apps/mobile/.maestro/prepare-phone-test.ps1` (clears Solace's data).
2. Open Solace, pin it.
3. Run `pwsh apps/mobile/.maestro/run-phone-test.ps1`. Output goes to `apps/mobile/.maestro/out/`.

The script deletes its throwaway account afterwards, pass or fail. Never add `launchApp` to the flows: stopping the pinned app ends pinning and locks the phone.

## Render
- **Delete the old Oregon service** `solace-api` once you're happy with Singapore. `render.yaml` no longer defines it.
- **cron-job.org** should ping `https://solace-api-sg.onrender.com/health`.

## Monday list
See `specs/MONDAY.md`. In short:
- **Speed and memory:** startup under 2 s, Today memory about 350 MB.
- **Today scene:** reflection, moon, night clouds, dawn and dusk light.
- **Kit:** TabBar press scale; Today's direct haptics and raw constants (needs your OK, since Today is locked).
- **Onboarding:** Sola jumps between steps 1 and 2.
- **Check-in suggestion:** it once quoted the mood score.
