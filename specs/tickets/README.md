# Tickets

One folder per ticket: `NN-name/ticket.md` (what to build) and `NN-name/eval.md` (how we know it's done).

## Workflow
1. Read the ticket, `CLAUDE.md` and the spec sections it names. State the plan in a few lines.
2. Build. Only touch the files the ticket allows.
3. Run the checks in `eval.md` and the shared checks below. Capture phone screenshots from the release build.
4. A separate reviewer sub-agent checks the ticket against `eval.md`, the shared checks and the `CLAUDE.md` design rules. Fix what it finds and re-review until it passes.
5. Commit and push. Send Ddk the screenshots. Move to the next ticket.

At most one parallel worker: a backend-only ticket may run in one background sub-agent while UI work continues.

## Branches and deploys
- App work lives on `app-build` (branched from `today-sky`). Nothing from the app goes to `main` until Ddk accepts it.
- Render deploys `apps/api` from `main`. Backend tickets commit only `apps/api` and `packages/shared` changes. Once a backend ticket passes review, those commits are cherry-picked onto `main` so Render deploys them. Mobile code never rides along.

## Decisions (Ddk, Nov 6)
1. API tests run against `TEST_DATABASE_URL` (Supabase project `solace-test`), never the real database.
2. `JWT_SECRET`, `GEMINI_API_KEY` and `DATABASE_URL` are set on Render and in `apps/api/.env`. Never printed, logged or committed.
3. cron-job.org pings `/health` every 10 minutes.
4. A mood tap on Today quietly saves the check-in (the last tap within about 1.5 s wins). The suggestion updates from the API. No sheet and no toast on Today.
5. The goal and reminder times picked in onboarding are kept on the phone and saved to the account after sign-up. Notification permission is asked on the reminders step, after a short explanation.
6. Splash tagline: "A calm place to land."
7. The You tab shows a constellation, one star per active day.
8. No forgot-password flow for the demo.
9. The Maestro CLI may be installed for the end-to-end flow.
10. Reflect questions are written in our own words, PHQ-4 and GAD style on a 0–3 scale. The sources checked are listed in the ticket, and Ddk approves the wording before Reflect ships.

## Shared checks (every UI ticket)
- `tsc --noEmit`, `expo lint` and `jest` pass in `apps/mobile`; `tsc` and `vitest` pass in `apps/api`. No test is weakened, skipped or deleted.
- **Kit only:** screens import UI from `src/components` and values from `src/theme`. Searching `app/` and `src/features/` (except `sky/`) finds no hex colors, and no numeric sizes, radii, spacing or durations in styles.
- **Release build on the Poco X7 Pro:** screenshots of every new screen in light and dark, saved to `design/screens/tickets/NN/`.
- **States:** loading shows a skeleton, plus empty and error states. Offline (airplane mode) shows an error within about 4 s, retries quietly, and recovers by itself.
- **Font scale 1.3×:** no clipped or overlapping text.
- **Reduce motion on:** nothing moves except fades.
- **Android back**, with both gesture and 3-button navigation: sheets close first, then the stack pops, then the app exits from Today. The user is never trapped.
- **Screen reader:** every control has a role and a label.
- **Smoothness:** the in-app frame timer reads at least 110 fps during the screen's main interaction, with no gap over 34 ms.
- **Memory:** every eval ends with a memory step that reports each new screen's cost (PSS before, during, after) and checks for a plateau with no upward trend.
