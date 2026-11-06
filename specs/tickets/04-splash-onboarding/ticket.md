# 04 Splash and onboarding

## Must do
- **Native splash:**
  - Background uses HIG tokens: `background` light `#F2F2F7`, dark `#000000`.
  - Replace the grid placeholder with Sola. The PNG is rendered from the app's own Skia Sola, through a dev-only export, then pulled with adb.
  - Remove the old `#EEF0F8`, `#12111C` and purple `#6F63E8` values from `app.config.ts`.
  - The notification color becomes the accent.
- **Animated splash:**
  - Sola fades in with the tagline "A calm place to land."
  - Runs the session refresh and wakes the API (`/health`) in parallel. Maximum 2.5 s, then routes.
- **Onboarding**, 4 steps, skippable after step 1:
  1. What Solace is.
  2. Meet Sola: Sola waves and says hi.
  3. Pick a goal: calm, sleep, focus, confidence or connection.
  4. Reminder times, with a pre-prompt explaining why, then the Android notification permission.
- Progress dots; swipe or tap Next. The last step leads to Sign up, with a "Log in" link.
- Choices are stored in a Zustand store persisted to MMKV until sign-up (decision 5).

## Files
- **New:** `app/splash` logic in `app/index.tsx`, `app/(onboarding)/*`, `src/features/onboarding/*`, `src/lib/storage.ts` (MMKV), `src/features/sola/Sola.tsx`.
- **Edit:** `app.config.ts`, `assets/splash-icon.png`.

## Must not touch
Today, the scene and the API.

## Decisions
- Sola is extracted into a reusable Skia component, `src/features/sola/Sola.tsx`, with the states from spec 7.4. Today keeps its own copy until a later ticket, so Today is untouched.
- Onboarding uses the sky gradient behind it (no landscape), drawn once and static.
